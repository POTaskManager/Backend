import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DrizzleService } from '../drizzle/drizzle.service';
import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schemas/global.schema';
import {
  NotificationEvent,
  NotificationJobData,
  NotificationPayload,
} from './events/notification-events';
import { NotificationsService } from './notifications.service';

// ============================================
// EMAIL DATA INTERFACE
// ============================================

interface EmailData {
  to: string[];
  subject: string;
  html: string;
}

// ============================================
// NOTIFICATIONS PROCESSOR
// ============================================

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private transporter: nodemailer.Transporter;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly drizzle: DrizzleService,
    private readonly notificationsService: NotificationsService
  ) {
    super();
    this.initializeTransporter();
    this.loadTemplates();
  }

  // ============================================
  // INITIALIZE EMAIL TRANSPORTER
  // ============================================

  private initializeTransporter() {
    const host = this.config.get<string>('SMTP_HOST', 'mailhog');
    const port = this.config.get<number>('SMTP_PORT', 1025);
    const secure = this.config.get<boolean>('SMTP_SECURE', false);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
    });

    this.logger.log(
      `Email transporter initialized: ${host}:${port} (secure: ${secure})`
    );
  }

  // ============================================
  // LOAD EMAIL TEMPLATES
  // ============================================

  private loadTemplates() {
    // In development (__dirname = /app/dist/notifications), templates are in /app/src/notifications/templates
    // In production (__dirname = /app/dist/notifications), templates should be in /app/dist/notifications/templates
    const isDev = process.env.NODE_ENV !== 'production';
    const templatesDir = isDev 
      ? join(__dirname, '../../src/notifications/templates')
      : join(__dirname, 'templates');

    try {
      // Base template
      const baseTemplate = readFileSync(
        join(templatesDir, 'base.hbs'),
        'utf-8'
      );
      this.templates.set('base', Handlebars.compile(baseTemplate));

      // Task templates
      this.templates.set(
        'task-assigned',
        Handlebars.compile(
          readFileSync(join(templatesDir, 'task-assigned.hbs'), 'utf-8')
        )
      );
      this.templates.set(
        'task-commented',
        Handlebars.compile(
          readFileSync(join(templatesDir, 'task-commented.hbs'), 'utf-8')
        )
      );
      this.templates.set(
        'task-updated',
        Handlebars.compile(
          readFileSync(join(templatesDir, 'task-updated.hbs'), 'utf-8')
        )
      );
      this.templates.set(
        'task-status-changed',
        Handlebars.compile(
          readFileSync(join(templatesDir, 'task-status-changed.hbs'), 'utf-8')
        )
      );

      // Sprint templates
      this.templates.set(
        'sprint-started',
        Handlebars.compile(
          readFileSync(join(templatesDir, 'sprint-started.hbs'), 'utf-8')
        )
      );
      this.templates.set(
        'sprint-completed',
        Handlebars.compile(
          readFileSync(join(templatesDir, 'sprint-completed.hbs'), 'utf-8')
        )
      );

      // Mention template
      this.templates.set(
        'user-mentioned',
        Handlebars.compile(
          readFileSync(join(templatesDir, 'user-mentioned.hbs'), 'utf-8')
        )
      );

      this.logger.log(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      this.logger.error('Failed to load email templates:', error);
    }
  }

  // ============================================
  // PROCESS NOTIFICATION JOB
  // ============================================

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { event, payload, recipientIds } = job.data;

    this.logger.log(
      `Processing notification job ${job.id}: ${event} for ${recipientIds.length} recipients`
    );

    try {
      // Get recipient emails
      const recipients = await this.drizzle.getGlobalDb()
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, recipientIds[0])); // TODO: support multiple recipients

      if (recipients.length === 0) {
        this.logger.warn(`No recipients found for job ${job.id}`);
        return;
      }

      // For each recipient, send email and log
      for (const recipientId of recipientIds) {
        try {
          const recipient = await this.drizzle.getGlobalDb()
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
            })
            .from(users)
            .where(eq(users.id, recipientId))
            .limit(1);

          if (recipient.length === 0) {
            this.logger.warn(`User ${recipientId} not found`);
            await this.notificationsService.logNotification(
              recipientId,
              event,
              payload,
              'skipped',
              'email',
              'User not found'
            );
            continue;
          }

          const user = recipient[0];

          // Prepare email data
          const emailData = this.prepareEmailData(
            event,
            payload,
            user.email,
            user.name || 'User'
          );

          // Send email
          await this.sendEmail(emailData);

          // Log success
          await this.notificationsService.logNotification(
            recipientId,
            event,
            payload,
            'sent',
            'email'
          );

          this.logger.log(
            `Sent ${event} notification to ${user.email} (${user.name || 'User'})`
          );
        } catch (error) {
          this.logger.error(
            `Failed to send notification to ${recipientId}:`,
            error
          );
          await this.notificationsService.logNotification(
            recipientId,
            event,
            payload,
            'failed',
            'email',
            error.message
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process notification job ${job.id}:`, error);
      throw error;
    }
  }

  // ============================================
  // PREPARE EMAIL DATA
  // ============================================

  private prepareEmailData(
    event: NotificationEvent,
    payload: NotificationPayload,
    recipientEmail: string,
    recipientName: string
  ): EmailData {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000'
    );

    let subject = '';
    let templateName = '';
    let templateData: any = {
      recipientName,
      projectName: payload.projectName,
      actorName: payload.actorName,
      frontendUrl,
    };

    switch (event) {
      case NotificationEvent.TASK_ASSIGNED:
        subject = `You were assigned to "${(payload as any).taskTitle}"`;
        templateName = 'task-assigned';
        templateData = {
          ...templateData,
          taskTitle: (payload as any).taskTitle,
          taskUrl: `${frontendUrl}/projects/${payload.projectId}/tasks/${(payload as any).taskId}`,
        };
        break;

      case NotificationEvent.TASK_COMMENTED:
        subject = `New comment on "${(payload as any).taskTitle}"`;
        templateName = 'task-commented';
        templateData = {
          ...templateData,
          taskTitle: (payload as any).taskTitle,
          commentText: (payload as any).commentText,
          taskUrl: `${frontendUrl}/projects/${payload.projectId}/tasks/${(payload as any).taskId}`,
        };
        break;

      case NotificationEvent.TASK_UPDATED:
        subject = `Task updated: "${(payload as any).taskTitle}"`;
        templateName = 'task-updated';
        templateData = {
          ...templateData,
          taskTitle: (payload as any).taskTitle,
          changes: (payload as any).changes,
          taskUrl: `${frontendUrl}/projects/${payload.projectId}/tasks/${(payload as any).taskId}`,
        };
        break;

      case NotificationEvent.TASK_STATUS_CHANGED:
        subject = `Task status changed: "${(payload as any).taskTitle}"`;
        templateName = 'task-status-changed';
        templateData = {
          ...templateData,
          taskTitle: (payload as any).taskTitle,
          oldStatus: (payload as any).oldStatus,
          newStatus: (payload as any).newStatus,
          taskUrl: `${frontendUrl}/projects/${payload.projectId}/tasks/${(payload as any).taskId}`,
        };
        break;

      case NotificationEvent.SPRINT_STARTED:
        subject = `Sprint started: "${(payload as any).sprintName}"`;
        templateName = 'sprint-started';
        templateData = {
          ...templateData,
          sprintName: (payload as any).sprintName,
          startDate: (payload as any).startDate,
          endDate: (payload as any).endDate,
          taskCount: (payload as any).taskCount,
          sprintUrl: `${frontendUrl}/projects/${payload.projectId}/sprints/${(payload as any).sprintId}`,
        };
        break;

      case NotificationEvent.SPRINT_COMPLETED:
        subject = `Sprint completed: "${(payload as any).sprintName}"`;
        templateName = 'sprint-completed';
        templateData = {
          ...templateData,
          sprintName: (payload as any).sprintName,
          completedTasks: (payload as any).completedTasks,
          totalTasks: (payload as any).totalTasks,
          sprintUrl: `${frontendUrl}/projects/${payload.projectId}/sprints/${(payload as any).sprintId}`,
        };
        break;

      case NotificationEvent.COMMENT_MENTIONED:
      case NotificationEvent.CHAT_MENTIONED:
        subject = `${payload.actorName} mentioned you`;
        templateName = 'user-mentioned';
        templateData = {
          ...templateData,
          messageText:
            event === NotificationEvent.COMMENT_MENTIONED
              ? (payload as any).commentText
              : (payload as any).messageText,
          contextUrl:
            event === NotificationEvent.COMMENT_MENTIONED && (payload as any).taskId
              ? `${frontendUrl}/projects/${payload.projectId}/tasks/${(payload as any).taskId}`
              : `${frontendUrl}/projects/${payload.projectId}/chat`,
        };
        break;

      default:
        subject = `Notification from ${payload.projectName}`;
        templateName = 'base';
    }

    // Get template
    const contentTemplate = this.templates.get(templateName);
    const baseTemplate = this.templates.get('base');

    if (!contentTemplate || !baseTemplate) {
      this.logger.warn(
        `Template not found: ${templateName}, using fallback`
      );
      return {
        to: [recipientEmail],
        subject,
        html: `<p>You have a new notification from ${payload.projectName}</p>`,
      };
    }

    // Render content and wrap in base template
    const content = contentTemplate(templateData);
    const html = baseTemplate({
      ...templateData,
      content,
      subject,
    });

    return {
      to: [recipientEmail],
      subject,
      html,
    };
  }

  // ============================================
  // SEND EMAIL
  // ============================================

  private async sendEmail(emailData: EmailData): Promise<void> {
    const from = this.config.get<string>(
      'SMTP_FROM',
      'noreply@potask.local'
    );

    await this.transporter.sendMail({
      from,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    });
  }
}
