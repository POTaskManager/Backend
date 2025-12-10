import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateBoardDto } from './dto/create-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(projectId: string, dto: CreateBoardDto) {
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

    // Get max order to append new column
    const maxOrder = await projectClient.columns.findFirst({
      orderBy: { col_order: 'desc' },
      select: { col_order: true },
    });

    // Create column in project database
    return projectClient.columns.create({
      data: {
        col_name: dto.name,
        col_order: (maxOrder?.col_order ?? -1) + 1,
      },
      select: {
        col_columnid: true,
        col_name: true,
        col_order: true,
        col_created_at: true,
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

    // Fetch columns from project database
    return projectClient.columns.findMany({
      orderBy: { col_order: 'asc' },
      select: {
        col_columnid: true,
        col_name: true,
        col_order: true,
        col_created_at: true,
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

    // Fetch column from project database
    const column = await projectClient.columns.findUnique({
      where: { col_columnid: id },
      select: {
        col_columnid: true,
        col_name: true,
        col_order: true,
        col_created_at: true,
      },
    });

    if (!column) {
      throw new NotFoundException(
        `Board ${id} not found in project ${projectId}`,
      );
    }

    return column;
  }
}
