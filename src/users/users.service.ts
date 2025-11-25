import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { createHash } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const passwordHash = this.hashPassword(dto.password);

    return this.prisma.users.create({
      data: {
        user_FirstName: dto.firstName,
        user_LastName: dto.lastName,
        user_Email: dto.email,
        user_PasswordHash: passwordHash,
      },
      select: {
        user_userId: true,
        user_FirstName: true,
        user_LastName: true,
        user_Email: true,
        user_IsActive: true,
        user_CreationDate: true,
      },
    });
  }

  findAll() {
    return this.prisma.users.findMany({
      select: {
        user_userId: true,
        user_FirstName: true,
        user_LastName: true,
        user_Email: true,
        user_IsActive: true,
        user_CreationDate: true,
        user_LastLogin: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.users.findUnique({
      where: { user_userId: id },
      select: {
        user_userId: true,
        user_FirstName: true,
        user_LastName: true,
        user_Email: true,
        user_IsActive: true,
        user_CreationDate: true,
        user_LastLogin: true,
      },
    });
  }

  private hashPassword(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }
}
