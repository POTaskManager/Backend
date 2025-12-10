import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateSprintDto } from './dto/create-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(projectId: string, dto: CreateSprintDto) {
    // Get project to find namespace
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
      select: { proj_db_namespace: true },
    });

    if (!project || !project.proj_db_namespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.proj_db_namespace,
    );

    // Create sprint in project database
    return projectClient.sprints.create({
      data: {
        spr_name: dto.name,
        spr_start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        spr_end_date: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      select: {
        spr_sprintid: true,
        spr_name: true,
        spr_start_date: true,
        spr_end_date: true,
        spr_statusid: true,
      },
    });
  }

  async findAll(projectId: string) {
    // Get project to find namespace
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
      select: { proj_db_namespace: true },
    });

    if (!project || !project.proj_db_namespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.proj_db_namespace,
    );

    // Fetch sprints from project database
    return projectClient.sprints.findMany({
      select: {
        spr_sprintid: true,
        spr_name: true,
        spr_start_date: true,
        spr_end_date: true,
        spr_statusid: true,
      },
    });
  }

  async findOne(projectId: string, id: string) {
    // Get project to find namespace
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
      select: { proj_db_namespace: true },
    });

    if (!project || !project.proj_db_namespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.proj_db_namespace,
    );

    // Fetch sprint from project database
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: id },
      select: {
        spr_sprintid: true,
        spr_name: true,
        spr_start_date: true,
        spr_end_date: true,
        spr_statusid: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${id} not found in project ${projectId}`,
      );
    }

    return sprint;
  }
}
