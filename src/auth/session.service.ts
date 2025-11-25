import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OAuthTokenSet } from './google-mock.service';

export interface SessionRecord {
  sessionId: string;
  userId: string;
  provider: string;
  createdAt: Date;
  tokenPreview: Pick<OAuthTokenSet, 'accessToken' | 'expiresAt' | 'tokenType' | 'scope'>;
}

@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, SessionRecord>();

  createSession(userId: string, provider: string, tokenSet: OAuthTokenSet): SessionRecord {
    const sessionId = randomUUID();
    const record: SessionRecord = {
      sessionId,
      userId,
      provider,
      createdAt: new Date(),
      tokenPreview: {
        accessToken: tokenSet.accessToken,
        expiresAt: tokenSet.expiresAt,
        tokenType: tokenSet.tokenType,
        scope: tokenSet.scope,
      },
    };
    this.sessions.set(sessionId, record);
    return record;
  }

  findAll() {
    return Array.from(this.sessions.values());
  }
}
