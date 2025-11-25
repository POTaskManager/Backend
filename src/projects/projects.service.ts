import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProjectDto) {
    return this.prisma.projects.create({
      data: {
        proj_Name: dto.name,
        proj_Description: dto.description,
        proj_OwnerId: dto.ownerId,
        proj_StartDate: dto.startDate ? new Date(dto.startDate) : undefined,
        proj_EndDate: dto.endDate ? new Date(dto.endDate) : undefined,
        proj_State: dto.state,
      },
      select: {
        proj_projId: true,
        proj_Name: true,
        proj_Description: true,
        proj_OwnerId: true,
        proj_State: true,
        proj_StartDate: true,
        proj_EndDate: true,
        proj_CreationDate: true,
      },
    });
  }

  findAll() {
    return this.prisma.projects.findMany({
      select: {
        proj_projId: true,
        proj_Name: true,
        proj_Description: true,
        proj_OwnerId: true,
        proj_State: true,
        proj_StartDate: true,
        proj_EndDate: true,
        proj_CreationDate: true,
      },
    });
  }

  findForUser(userId: string) {
    return this.prisma.projects.findMany({
      where: {
        OR: [
          { proj_OwnerId: userId },
          {
            Members: {
              some: {
                prmb_UserId: userId,
              },
            },
          },
        ],
      },
      select: {
        proj_projId: true,
        proj_Name: true,
        proj_Description: true,
        proj_OwnerId: true,
        proj_State: true,
        proj_StartDate: true,
        proj_EndDate: true,
        proj_CreationDate: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.projects.findUnique({
      where: { proj_projId: id },
      select: {
        proj_projId: true,
        proj_Name: true,
        proj_Description: true,
        proj_OwnerId: true,
        proj_State: true,
        proj_StartDate: true,
        proj_EndDate: true,
        proj_CreationDate: true,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    return this.prisma.projects.update({
      where: { proj_projId: id },
      data: {
        proj_Name: dto.name,
        proj_Description: dto.description,
        proj_State: dto.state,
        proj_StartDate: dto.startDate ? new Date(dto.startDate) : undefined,
        proj_EndDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      select: {
        proj_projId: true,
        proj_Name: true,
        proj_Description: true,
        proj_OwnerId: true,
        proj_State: true,
        proj_StartDate: true,
        proj_EndDate: true,
        proj_CreationDate: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.projects.delete({
      where: { proj_projId: id },
      select: { proj_projId: true },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    return this.prisma.projectMembers.create({
      data: {
        prmb_ProjectId: projectId,
        prmb_UserId: dto.userId,
        prmb_RoleId: dto.roleId,
      },
      select: {
        prmb_prmbId: true,
        prmb_ProjectId: true,
        prmb_UserId: true,
        prmb_RoleId: true,
      },
    });
  }

  async removeMember(projectId: string, userId: string) {
    const existing = await this.prisma.projectMembers.findUnique({
      where: { prmb_ProjectId_prmb_UserId: { prmb_ProjectId: projectId, prmb_UserId: userId } },
      select: { prmb_prmbId: true },
    });
    if (!existing) {
      throw new NotFoundException('Member not found in project');
    }
    return this.prisma.projectMembers.delete({
      where: { prmb_prmbId: existing.prmb_prmbId },
      select: { prmb_prmbId: true },
    });
  }
}
