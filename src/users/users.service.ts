import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const passwordHash = this.hashPassword(dto.password);

    return this.prisma.user.create({
      data: {
        name: dto.firstName + ' ' + dto.lastName,
        email: dto.email,
        passwordHash: dto.password,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        passwordHash: true,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
      },
    });
  }

  private hashPassword(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  async createOrUpdateSession(userId: string, hashedRefreshToken: string) {
    const existingSession = await this.prisma.session.findFirst({
      where: { userId, revoked: false },
    });

    if (existingSession) {
      return this.prisma.session.update({
        where: { id: existingSession.id },
        data: {
          refreshTokenHash: hashedRefreshToken,
          lastSeenAt: new Date(),
        },
      });
    }

    return this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashedRefreshToken,
        lastSeenAt: new Date(),
      },
    });
  }

  async getUserSession(userId: string) {
    return this.prisma.session.findFirst({
      where: { userId, revoked: false },
      select: {
        id: true,
        refreshTokenHash: true,
      },
    });
  }

  async revokeSession(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
