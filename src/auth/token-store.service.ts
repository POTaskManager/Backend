import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { OAuthTokenSet } from './google-mock.service';

interface EncryptedRecord {
  cipherText: string;
  createdAt: Date;
}

@Injectable()
export class TokenStoreService {
  private readonly store = new Map<string, EncryptedRecord>();

  constructor(private readonly configService: ConfigService) {}

  async save(userId: string, provider: string, tokenSet: OAuthTokenSet) {
    const key = this.buildKey(userId, provider);
    const cipherText = this.encrypt(JSON.stringify(tokenSet));
    this.store.set(key, { cipherText, createdAt: new Date() });
    return { provider, userId, storedAt: new Date().toISOString() };
  }

  async findLatest(userId: string, provider: string): Promise<OAuthTokenSet | null> {
    const key = this.buildKey(userId, provider);
    const record = this.store.get(key);
    if (!record) {
      return null;
    }
    const payload = this.decrypt(record.cipherText);
    return JSON.parse(payload) as OAuthTokenSet;
  }

  private buildKey(userId: string, provider: string) {
    return `${provider}:${userId}`;
  }

  private getEncryptionKey(): Buffer {
    const secret = this.configService.get<string>('OAUTH_ENCRYPTION_KEY') ?? '';
    if (secret.length < 32) {
      throw new InternalServerErrorException(
        'OAUTH_ENCRYPTION_KEY must be at least 32 characters long to protect OAuth tokens',
      );
    }
    return Buffer.from(secret.substring(0, 32));
  }

  private encrypt(raw: string) {
    const key = this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const cipherText = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, cipherText]).toString('base64');
  }

  private decrypt(payload: string) {
    const key = this.getEncryptionKey();
    const data = Buffer.from(payload, 'base64');
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const cipherText = data.subarray(32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return plain.toString('utf8');
  }
}
