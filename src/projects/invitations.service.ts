import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { DrizzleService } from '../drizzle/drizzle.service';
import * as globalSchema from '../drizzle/schemas/global.schema';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface InvitationRecord {
  invitationId: string;
  projectId: string;
  email: string;
  roleId?: string;
  invitedBy?: string;
  token: string;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class InvitationsService {
  private transporter: nodemailer.Transporter;
  private resendClient: Resend | null = null;
  private emailProvider: string;

  constructor(
    private drizzleService: DrizzleService,
    private configService: ConfigService,
  ) {
    this.emailProvider = this.configService.get<string>('EMAIL_PROVIDER', 'smtp');
    
    if (this.emailProvider === 'resend') {
      const apiKey = this.configService.get<string>('RESEND_API_KEY');
      if (apiKey) {
        this.resendClient = new Resend(apiKey);
      }
    } else {
      this.initializeTransporter();
    }
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST', 'mailhog');
    const port = this.configService.get<number>('SMTP_PORT', 1025);
    const secureRaw = this.configService.get('SMTP_SECURE', 'false');
    const secure = secureRaw === true || secureRaw === 'true' || secureRaw === '1';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure && port === 587,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private getDb() {
    return this.drizzleService.getGlobalDb();
  }

  private async sendInvitationEmail(
    invitation: InvitationRecord,
    projectName: string,
    invitedByName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000'
    );
    const acceptUrl = `${frontendUrl}/accept-invitation?token=${invitation.token}`;

    const subject = `You've been invited to join ${projectName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; 
                   text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Project Invitation</h1>
          </div>
          <div class="content">
            <p>Hi,</p>
            <p><strong>${invitedByName}</strong> has invited you to join the project <strong>${projectName}</strong>.</p>
            <p>Click the button below to accept this invitation:</p>
            <a href="${acceptUrl}" class="button">Accept Invitation</a>
            <p>Or copy this link: <a href="${acceptUrl}">${acceptUrl}</a></p>
            <p>This invitation will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>POTask Manager - Project Management Tool</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = this.configService.get<string>(
      'SMTP_FROM',
      'onboarding@resend.dev'
    );

    if (this.emailProvider === 'resend' && this.resendClient) {
      // Use Resend API
      console.log(`[Resend] Sending email to ${invitation.email}`);
      const result = await this.resendClient.emails.send({
        from,
        to: invitation.email,
        subject,
        html,
      });
      console.log('[Resend] Email sent successfully:', result);
    } else {
      // Use SMTP
      console.log(`[SMTP] Sending email to ${invitation.email}`);
      await this.transporter.sendMail({
        from,
        to: invitation.email,
        subject,
        html,
      });
      console.log('[SMTP] Email sent successfully');
    }
  }

  async create(
    projectId: string,
    email: string,
    roleId: string,
    invitedBy: string,
  ): Promise<InvitationRecord> {
    const db = this.getDb();
    
    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, invitedBy) // We'll need to look up by email in the calling code
        )
      )
      .limit(1);

    // Check for existing pending invitation
    const existingInvitation = await db
      .select()
      .from(globalSchema.invitations)
      .where(
        and(
          eq(globalSchema.invitations.projectId, projectId),
          eq(globalSchema.invitations.email, email),
          eq(globalSchema.invitations.status, 'pending')
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      throw new BadRequestException('User already has a pending invitation for this project');
    }

    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db
      .insert(globalSchema.invitations)
      .values({
        projectId,
        email,
        roleId,
        invitedBy,
        token,
        status: 'pending',
        createdAt: now,
        expiresAt,
      })
      .returning();

    const record: InvitationRecord = {
      invitationId: invitation.id,
      projectId: invitation.projectId,
      email: invitation.email,
      roleId: invitation.roleId ?? undefined,
      invitedBy: invitation.invitedBy ?? undefined,
      token: invitation.token,
      status: invitation.status as InvitationStatus,
      createdAt: invitation.createdAt ?? now,
      expiresAt: invitation.expiresAt ?? expiresAt,
    };

    // Send invitation email
    try {
      const [project] = await db
        .select({ name: globalSchema.projects.name })
        .from(globalSchema.projects)
        .where(eq(globalSchema.projects.id, projectId))
        .limit(1);

      const [inviter] = await db
        .select({ name: globalSchema.users.name, email: globalSchema.users.email })
        .from(globalSchema.users)
        .where(eq(globalSchema.users.id, invitedBy))
        .limit(1);

      await this.sendInvitationEmail(
        record,
        project?.name ?? 'Project',
        inviter?.name ?? inviter?.email ?? 'A team member'
      );
    } catch (error) {
      // Log error but don't fail the invitation creation
      console.error('Failed to send invitation email:', error);
    }

    return record;
  }

  async listPending(projectId: string): Promise<InvitationRecord[]> {
    const db = this.getDb();
    
    const invitations = await db
      .select()
      .from(globalSchema.invitations)
      .where(
        and(
          eq(globalSchema.invitations.projectId, projectId),
          eq(globalSchema.invitations.status, 'pending')
        )
      );

    return invitations.map((inv) => ({
      invitationId: inv.id,
      projectId: inv.projectId,
      email: inv.email,
      roleId: inv.roleId ?? undefined,
      invitedBy: inv.invitedBy ?? undefined,
      token: inv.token,
      status: inv.status as InvitationStatus,
      createdAt: inv.createdAt ?? new Date(),
      expiresAt: inv.expiresAt ?? new Date(),
    }));
  }

  async listForUser(userEmail: string): Promise<Array<InvitationRecord & { projectName: string; inviterName: string; roleName?: string }>> {
    const db = this.getDb();
    
    const invitations = await db
      .select({
        invitation: globalSchema.invitations,
        projectName: globalSchema.projects.name,
        inviterName: globalSchema.users.name,
        inviterEmail: globalSchema.users.email,
        roleName: globalSchema.roles.name,
      })
      .from(globalSchema.invitations)
      .leftJoin(
        globalSchema.projects,
        eq(globalSchema.invitations.projectId, globalSchema.projects.id)
      )
      .leftJoin(
        globalSchema.users,
        eq(globalSchema.invitations.invitedBy, globalSchema.users.id)
      )
      .leftJoin(
        globalSchema.roles,
        eq(globalSchema.invitations.roleId, globalSchema.roles.id)
      )
      .where(
        and(
          eq(globalSchema.invitations.email, userEmail),
          eq(globalSchema.invitations.status, 'pending')
        )
      );

    return invitations.map((row) => ({
      invitationId: row.invitation.id,
      projectId: row.invitation.projectId,
      email: row.invitation.email,
      roleId: row.invitation.roleId ?? undefined,
      invitedBy: row.invitation.invitedBy ?? undefined,
      token: row.invitation.token,
      status: row.invitation.status as InvitationStatus,
      createdAt: row.invitation.createdAt ?? new Date(),
      expiresAt: row.invitation.expiresAt ?? new Date(),
      projectName: row.projectName ?? 'Unknown Project',
      inviterName: row.inviterName ?? row.inviterEmail ?? 'Unknown User',
      roleName: row.roleName ?? undefined,
    }));
  }

  async findByToken(token: string): Promise<InvitationRecord | null> {
    const db = this.getDb();
    
    const [invitation] = await db
      .select()
      .from(globalSchema.invitations)
      .where(eq(globalSchema.invitations.token, token))
      .limit(1);

    if (!invitation) {
      return null;
    }

    return {
      invitationId: invitation.id,
      projectId: invitation.projectId,
      email: invitation.email,
      roleId: invitation.roleId ?? undefined,
      invitedBy: invitation.invitedBy ?? undefined,
      token: invitation.token,
      status: invitation.status as InvitationStatus,
      createdAt: invitation.createdAt ?? new Date(),
      expiresAt: invitation.expiresAt ?? new Date(),
    };
  }

  async accept(token: string, userId: string): Promise<InvitationRecord> {
    const db = this.getDb();
    
    const invitation = await this.findByToken(token);
    
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Invitation is already ${invitation.status}`);
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await db
        .update(globalSchema.invitations)
        .set({ status: 'expired' })
        .where(eq(globalSchema.invitations.token, token));
      throw new BadRequestException('Invitation has expired');
    }

    // Verify user email matches invitation
    const [user] = await db
      .select()
      .from(globalSchema.users)
      .where(eq(globalSchema.users.id, userId))
      .limit(1);

    if (!user || user.email !== invitation.email) {
      throw new BadRequestException('Email does not match invitation');
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, invitation.projectId),
          eq(globalSchema.projectAccess.userId, userId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw new BadRequestException('User is already a member of this project');
    }

    // Add user to project
    await db.insert(globalSchema.projectAccess).values({
      userId,
      projectId: invitation.projectId,
      roleId: invitation.roleId,
      accepted: true,
      invitedAt: invitation.createdAt,
      createdAt: new Date(),
    });

    // Mark invitation as accepted
    const [updated] = await db
      .update(globalSchema.invitations)
      .set({ status: 'accepted' })
      .where(eq(globalSchema.invitations.token, token))
      .returning();

    return {
      invitationId: updated.id,
      projectId: updated.projectId,
      email: updated.email,
      roleId: updated.roleId ?? undefined,
      invitedBy: updated.invitedBy ?? undefined,
      token: updated.token,
      status: updated.status as InvitationStatus,
      createdAt: updated.createdAt ?? new Date(),
      expiresAt: updated.expiresAt ?? new Date(),
    };
  }

  async cancel(projectId: string, email: string): Promise<void> {
    const db = this.getDb();
    
    await db
      .update(globalSchema.invitations)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(globalSchema.invitations.projectId, projectId),
          eq(globalSchema.invitations.email, email),
          eq(globalSchema.invitations.status, 'pending')
        )
      );
  }

  async resend(projectId: string, email: string): Promise<InvitationRecord> {
    const db = this.getDb();
    
    // Find existing invitation
    const [existing] = await db
      .select()
      .from(globalSchema.invitations)
      .where(
        and(
          eq(globalSchema.invitations.projectId, projectId),
          eq(globalSchema.invitations.email, email),
          eq(globalSchema.invitations.status, 'pending')
        )
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('No pending invitation found for this email');
    }

    // Generate new token and extend expiry
    const newToken = randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(globalSchema.invitations)
      .set({
        token: newToken,
        expiresAt: newExpiresAt,
      })
      .where(eq(globalSchema.invitations.id, existing.id))
      .returning();

    const record: InvitationRecord = {
      invitationId: updated.id,
      projectId: updated.projectId,
      email: updated.email,
      roleId: updated.roleId ?? undefined,
      invitedBy: updated.invitedBy ?? undefined,
      token: updated.token,
      status: updated.status as InvitationStatus,
      createdAt: updated.createdAt ?? new Date(),
      expiresAt: updated.expiresAt ?? new Date(),
    };

    // Resend invitation email
    try {
      const [project] = await db
        .select({ name: globalSchema.projects.name })
        .from(globalSchema.projects)
        .where(eq(globalSchema.projects.id, projectId))
        .limit(1);

      const [inviter] = await db
        .select({ name: globalSchema.users.name, email: globalSchema.users.email })
        .from(globalSchema.users)
        .where(eq(globalSchema.users.id, updated.invitedBy ?? ''))
        .limit(1);

      await this.sendInvitationEmail(
        record,
        project?.name ?? 'Project',
        inviter?.name ?? inviter?.email ?? 'A team member'
      );
    } catch (error) {
      console.error('Failed to resend invitation email:', error);
    }

    return record;
  }
}
