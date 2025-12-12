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
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { dbNamespace: true },
    });

    if (!project || !project.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.dbNamespace,
    );

    // Get max order to append new column
    const maxOrder = await projectClient.column.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    // Create column in project database
    return projectClient.column.create({
      data: {
        name: dto.name,
        order: (maxOrder?.order ?? -1) + 1,
      },
      select: {
        id: true,
        name: true,
        order: true,
        createdAt: true,
      },
    });
  }

  async findAll(projectId: string) {
    // Get project to find namespace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { dbNamespace: true },
    });

    if (!project || !project.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.dbNamespace,
    );

    // Fetch columns from project database
    return projectClient.column.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
        createdAt: true,
      },
    });
  }

  async findOne(projectId: string, id: string) {
    // Get project to find namespace
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { dbNamespace: true },
    });

    if (!project || !project.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.dbNamespace,
    );

    // Fetch column from project database
    const column = await projectClient.column.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        order: true,
        createdAt: true,
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
