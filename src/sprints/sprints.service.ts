import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSprintDto } from './dto/create-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSprintDto) {
    return this.prisma.sprints.create({
      data: {
        spr_BoardId: dto.boardId,
        spr_Name: dto.name,
        spr_StartDate: dto.startDate ? new Date(dto.startDate) : undefined,
        spr_EndDate: dto.endDate ? new Date(dto.endDate) : undefined,
        spr_Goal: dto.goal,
        spr_State: dto.state,
      },
      select: {
        spr_sprId: true,
        spr_BoardId: true,
        spr_Name: true,
        spr_StartDate: true,
        spr_EndDate: true,
        spr_Goal: true,
        spr_State: true,
      },
    });
  }

  findAll() {
    return this.prisma.sprints.findMany({
      select: {
        spr_sprId: true,
        spr_BoardId: true,
        spr_Name: true,
        spr_StartDate: true,
        spr_EndDate: true,
        spr_Goal: true,
        spr_State: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.sprints.findUnique({
      where: { spr_sprId: id },
      select: {
        spr_sprId: true,
        spr_BoardId: true,
        spr_Name: true,
        spr_StartDate: true,
        spr_EndDate: true,
        spr_Goal: true,
        spr_State: true,
      },
    });
  }
}
