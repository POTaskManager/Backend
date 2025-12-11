import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const passwordHash = this.hashPassword(dto.password);

    return this.prisma.users.create({
      data: {
        user_name: dto.firstName + ' ' + dto.lastName,
        user_email: dto.email,
        user_password_hash: dto.password,
      },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
        is_active: true,
        user_created_at: true,
      },
    });
  }

  findAll() {
    return this.prisma.users.findMany({
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
        is_active: true,
        user_created_at: true,
        last_login: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.users.findUnique({
      where: { user_userid: id },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
        is_active: true,
        user_created_at: true,
        last_login: true,
        user_password_hash: true,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { user_email: email },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
        user_password_hash: true,
      },
    });
  }

  private hashPassword(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  async createOrUpdateSession(userId: string, hashedRefreshToken: string) {
    const existingSession = await this.prisma.sessions.findFirst({
      where: { user_id: userId, revoked: false },
    });

    if (existingSession) {
      return this.prisma.sessions.update({
        where: { session_id: existingSession.session_id },
        data: {
          refresh_token_hash: hashedRefreshToken,
          last_seen_at: new Date(),
        },
      });
    }

    return this.prisma.sessions.create({
      data: {
        user_id: userId,
        refresh_token_hash: hashedRefreshToken,
        last_seen_at: new Date(),
      },
    });
  }

  async getUserSession(userId: string) {
    return this.prisma.sessions.findFirst({
      where: { user_id: userId, revoked: false },
      select: {
        session_id: true,
        refresh_token_hash: true,
      },
    });
  }

  async revokeSession(userId: string) {
    return this.prisma.sessions.updateMany({
      where: { user_id: userId, revoked: false },
      data: { revoked: true },
    });
  }
}
