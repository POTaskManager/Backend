import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';

export type InvitationStatus = 'pending' | 'accepted';

export interface InvitationRecord {
  invitationId: string;
  projectId: string;
  email: string;
  roleId?: string;
  invitedBy?: string;
  token: string;
  status: InvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class InvitationsService {
  private readonly storage = new Map<string, InvitationRecord>();

  listPending(projectId: string): InvitationRecord[] {
    return Array.from(this.storage.values()).filter(
      (inv) => inv.projectId === projectId && inv.status === 'pending',
    );
  }

  resendInvitation(
    projectId: string,
    email: string,
    roleId?: string,
    invitedBy?: string,
  ) {
    const token = randomBytes(24).toString('hex');
    const now = new Date();
    const record: InvitationRecord = {
      invitationId: randomUUID(),
      projectId,
      email,
      roleId,
      invitedBy,
      token,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.storage.set(token, record);
    return record;
  }

  accept(token: string): InvitationRecord | null {
    const record = this.storage.get(token);
    if (!record || record.status !== 'pending') {
      return null;
    }
    record.status = 'accepted';
    record.updatedAt = new Date();
    this.storage.set(token, record);
    return record;
  }
}
