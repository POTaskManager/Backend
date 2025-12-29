import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and, inArray } from 'drizzle-orm';
import { DrizzleService } from '../drizzle/drizzle.service';
import {
  notificationPreferences,
  notificationLogs,
  users,
  projectAccess,
} from '../drizzle/schemas/global.schema';
import {
  NotificationEvent,
  NotificationPayload,
  NotificationJobData,
} from './events/notification-events';

// ============================================
// TYPES
// ============================================

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  events: Record<string, boolean>;
}

export interface UpdatePreferencesDto {
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  events?: Record<string, boolean>;
}

// ============================================
// NOTIFICATIONS SERVICE
// ============================================

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
    private readonly drizzle: DrizzleService
  ) {}

  // ============================================
  // EMIT NOTIFICATION
  // ============================================

  /**
   * Emit a notification event - determines recipients and queues notification jobs
   */
  async emit(event: NotificationEvent, payload: NotificationPayload) {
    try {
      this.logger.log(
        `Emitting notification: ${event} for project ${payload.projectId}`
      );

      // Determine recipients based on event type
      const recipientIds = await this.getUsersToNotify(event, payload);

      if (recipientIds.length === 0) {
        this.logger.debug(
          `No recipients for event ${event} in project ${payload.projectId}`
        );
        return;
      }

      // Filter by user preferences
      const filteredRecipients = await this.filterByPreferences(
        recipientIds,
        event
      );

      if (filteredRecipients.length === 0) {
        this.logger.debug(
          `All recipients opted out of event ${event} in project ${payload.projectId}`
        );
        return;
      }

      // Queue notification job for BullMQ processor
      const jobData: NotificationJobData = {
        event,
        payload,
        recipientIds: filteredRecipients,
        timestamp: new Date(),
      };

      await this.notificationQueue.add('send-notification', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(
        `Queued notification ${event} for ${filteredRecipients.length} recipients`
      );
    } catch (error) {
      this.logger.error(`Failed to emit notification ${event}:`, error);
      throw error;
    }
  }

  // ============================================
  // DETERMINE RECIPIENTS
  // ============================================

  /**
   * Determine which users should receive this notification based on event type
   */
  private async getUsersToNotify(
    event: NotificationEvent,
    payload: NotificationPayload
  ): Promise<string[]> {
    const recipientIds: Set<string> = new Set();

    // Get all project members
    const projectMembers = await this.drizzle.getGlobalDb()
      .select({ userId: projectAccess.userId })
      .from(projectAccess)
      .where(eq(projectAccess.projectId, payload.projectId));

    const memberIds = projectMembers.map((m) => m.userId);

    switch (event) {
      case NotificationEvent.TASK_ASSIGNED:
        // Notify assignee
        if ('assigneeId' in payload && payload.assigneeId) {
          recipientIds.add(payload.assigneeId);
        }
        break;

      case NotificationEvent.TASK_COMMENTED:
      case NotificationEvent.TASK_UPDATED:
      case NotificationEvent.TASK_STATUS_CHANGED:
        // Notify assignee (if exists)
        if ('assigneeId' in payload && payload.assigneeId) {
          recipientIds.add(payload.assigneeId);
        }
        // For comments with mentions, notify mentioned users
        if (
          'mentionedUserIds' in payload &&
          Array.isArray(payload.mentionedUserIds)
        ) {
          payload.mentionedUserIds.forEach((id) => recipientIds.add(id));
        }
        break;

      case NotificationEvent.COMMENT_MENTIONED:
      case NotificationEvent.CHAT_MENTIONED:
        // Notify mentioned user
        if ('mentionedUserId' in payload) {
          recipientIds.add(payload.mentionedUserId);
        }
        break;

      case NotificationEvent.SPRINT_STARTED:
      case NotificationEvent.SPRINT_COMPLETED:
        // Notify all project members
        memberIds.forEach((id) => recipientIds.add(id));
        break;

      case NotificationEvent.TASK_CREATED:
      case NotificationEvent.SPRINT_CREATED:
      case NotificationEvent.SPRINT_TASK_ADDED:
      case NotificationEvent.COMMENT_CREATED:
        // Only notify users who opted in (default is false)
        memberIds.forEach((id) => recipientIds.add(id));
        break;

      case NotificationEvent.TASK_DELETED:
        // Notify previous assignee
        if ('assigneeId' in payload && payload.assigneeId) {
          recipientIds.add(payload.assigneeId);
        }
        break;

      default:
        this.logger.warn(`Unknown notification event: ${event}`);
    }

    // Exclude the actor (user who triggered the event)
    recipientIds.delete(payload.actorId);

    return Array.from(recipientIds);
  }

  // ============================================
  // FILTER BY PREFERENCES
  // ============================================

  /**
   * Filter recipients based on their notification preferences
   */
  private async filterByPreferences(
    recipientIds: string[],
    event: NotificationEvent
  ): Promise<string[]> {
    if (recipientIds.length === 0) return [];

    const preferences = await this.drizzle.getGlobalDb()
      .select()
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, recipientIds));

    const filtered: string[] = [];

    for (const userId of recipientIds) {
      const userPref = preferences.find((p) => p.userId === userId);

      // If no preferences exist, create default (email enabled)
      if (!userPref) {
        await this.createDefaultPreferences(userId);
        // Check default settings for this event
        const defaultEvents = this.getDefaultEventSettings();
        if (defaultEvents[event]) {
          filtered.push(userId);
        }
        continue;
      }

      // Check if email is enabled and event is enabled
      if (userPref.emailEnabled && userPref.events) {
        const events = userPref.events as Record<string, boolean>;
        if (events[event] === true) {
          filtered.push(userId);
        }
      }
    }

    return filtered;
  }

  // ============================================
  // PREFERENCES MANAGEMENT
  // ============================================

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await this.drizzle.getGlobalDb()
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (prefs.length === 0) {
      // Create default preferences
      await this.createDefaultPreferences(userId);
      return {
        emailEnabled: true,
        pushEnabled: false,
        events: this.getDefaultEventSettings(),
      };
    }

    const pref = prefs[0];
    return {
      emailEnabled: pref.emailEnabled ?? true,
      pushEnabled: pref.pushEnabled ?? false,
      events: (pref.events as Record<string, boolean>) || this.getDefaultEventSettings(),
    };
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: UpdatePreferencesDto
  ): Promise<NotificationPreferences> {
    const existing = await this.drizzle.getGlobalDb()
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      // Create with updates
      await this.drizzle.getGlobalDb().insert(notificationPreferences).values({
        userId,
        emailEnabled: updates.emailEnabled ?? true,
        pushEnabled: updates.pushEnabled ?? false,
        events: updates.events || this.getDefaultEventSettings(),
      });
    } else {
      // Update existing
      const currentEvents = (existing[0].events as Record<string, boolean>) || {};
      const newEvents = updates.events
        ? { ...currentEvents, ...updates.events }
        : currentEvents;

      await this.drizzle.getGlobalDb()
        .update(notificationPreferences)
        .set({
          emailEnabled: updates.emailEnabled ?? existing[0].emailEnabled,
          pushEnabled: updates.pushEnabled ?? existing[0].pushEnabled,
          events: newEvents,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, userId));
    }

    return this.getPreferences(userId);
  }

  /**
   * Create default notification preferences for a user
   */
  private async createDefaultPreferences(userId: string): Promise<void> {
    await this.drizzle.getGlobalDb().insert(notificationPreferences).values({
      userId,
      emailEnabled: true,
      pushEnabled: false,
      events: this.getDefaultEventSettings(),
    });
  }

  /**
   * Get default event settings (matches globaldb.sql defaults)
   */
  private getDefaultEventSettings(): Record<string, boolean> {
    return {
      'task.created': false,
      'task.assigned': true,
      'task.updated': true,
      'task.status_changed': true,
      'task.commented': true,
      'task.deleted': true,
      'sprint.created': false,
      'sprint.started': true,
      'sprint.completed': true,
      'sprint.task_added': false,
      'comment.created': true,
      'comment.mentioned': true,
      'chat.mentioned': true,
    };
  }

  // ============================================
  // AUDIT LOGGING
  // ============================================

  /**
   * Log a notification attempt to the database
   */
  async logNotification(
    userId: string,
    event: NotificationEvent,
    eventData: any,
    status: 'pending' | 'sent' | 'failed' | 'skipped',
    channel: 'email' | 'push',
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.drizzle.getGlobalDb().insert(notificationLogs).values({
        userId,
        eventType: event,
        eventData,
        status,
        channel,
        errorMessage,
        sentAt: status === 'sent' ? new Date() : null,
      });
    } catch (error) {
      this.logger.error('Failed to log notification:', error);
      // Don't throw - logging failure shouldn't break notifications
    }
  }
}
