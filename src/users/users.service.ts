import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hash } from 'bcrypt';
import { DrizzleService } from '../drizzle/drizzle.service';
import * as globalSchema from '../drizzle/schemas/global.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private drizzleService: DrizzleService) {}

  private getDb(): NodePgDatabase<typeof globalSchema> {
    return this.drizzleService.getGlobalDb();
  }

  async create(dto: CreateUserDto) {
    const db = this.getDb();

    // Build name from firstName and lastName, handling undefined/empty values
    const nameParts = [dto.firstName, dto.lastName].filter(part => part && part.trim());
    const fullName = nameParts.length > 0 ? nameParts.join(' ') : dto.email.split('@')[0];

    // Hash password only if provided (OAuth users don't have password)
    const passwordHash = dto.password ? await this.hashPassword(dto.password) : null;

    const user = await db
      .insert(globalSchema.users)
      .values({
        email: dto.email,
        passwordHash,
        name: fullName,
        isActive: true,
        emailVerified: false,
      })
      .returning({
        id: globalSchema.users.id,
        name: globalSchema.users.name,
        email: globalSchema.users.email,
        isActive: globalSchema.users.isActive,
        createdAt: globalSchema.users.createdAt,
      });

    return user[0];
  }

  async findAll() {
    const db = this.getDb();

    return db
      .select({
        id: globalSchema.users.id,
        name: globalSchema.users.name,
        email: globalSchema.users.email,
        isActive: globalSchema.users.isActive,
        createdAt: globalSchema.users.createdAt,
        lastLogin: globalSchema.users.lastLogin,
      })
      .from(globalSchema.users);
  }

  async findOne(id: string) {
    const db = this.getDb();

    const result = await db
      .select({
        id: globalSchema.users.id,
        name: globalSchema.users.name,
        email: globalSchema.users.email,
        isActive: globalSchema.users.isActive,
        createdAt: globalSchema.users.createdAt,
        lastLogin: globalSchema.users.lastLogin,
        passwordHash: globalSchema.users.passwordHash,
      })
      .from(globalSchema.users)
      .where(eq(globalSchema.users.id, id));

    return result[0] || null;
  }

  async findByEmail(email: string) {
    const db = this.getDb();

    const result = await db
      .select({
        id: globalSchema.users.id,
        name: globalSchema.users.name,
        email: globalSchema.users.email,
        passwordHash: globalSchema.users.passwordHash,
      })
      .from(globalSchema.users)
      .where(eq(globalSchema.users.email, email));

    return result[0] || null;
  }

  async createOrUpdateSession(userId: string, hashedRefreshToken: string) {
    const db = this.getDb();

    const existing = await db
      .select()
      .from(globalSchema.sessions)
      .where(
        and(
          eq(globalSchema.sessions.userId, userId),
          eq(globalSchema.sessions.revoked, false)
        )
      );

    if (existing.length > 0) {
      await db
        .update(globalSchema.sessions)
        .set({
          refreshTokenHash: hashedRefreshToken,
          lastSeenAt: new Date(),
        })
        .where(eq(globalSchema.sessions.id, existing[0].id));

      return existing[0];
    }

    const session = await db
      .insert(globalSchema.sessions)
      .values({
        userId,
        refreshTokenHash: hashedRefreshToken,
        lastSeenAt: new Date(),
        revoked: false,
      })
      .returning();

    return session[0];
  }

  async getUserSession(userId: string) {
    const db = this.getDb();

    const result = await db
      .select({
        id: globalSchema.sessions.id,
        refreshTokenHash: globalSchema.sessions.refreshTokenHash,
      })
      .from(globalSchema.sessions)
      .where(
        and(
          eq(globalSchema.sessions.userId, userId),
          eq(globalSchema.sessions.revoked, false)
        )
      );

    return result[0] || null;
  }

  async revokeSession(userId: string) {
    const db = this.getDb();

    return db
      .update(globalSchema.sessions)
      .set({ revoked: true })
      .where(
        and(
          eq(globalSchema.sessions.userId, userId),
          eq(globalSchema.sessions.revoked, false)
        )
      );
  }

  async setPassword(userId: string, newPassword: string) {
    const db = this.getDb();
    const passwordHash = await this.hashPassword(newPassword);

    await db
      .update(globalSchema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(globalSchema.users.id, userId));

    return { success: true };
  }

  async hasPassword(userId: string): Promise<boolean> {
    const user = await this.findOne(userId);
    return !!(user && user.passwordHash);
  }

  private async hashPassword(raw: string) {
    return hash(raw, 10);
  }
}
