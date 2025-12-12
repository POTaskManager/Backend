import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(dto: CreateTaskDto) {
    // Get project to find namespace
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { dbNamespace: true },
    });

    if (!project || !project.dbNamespace) {
      throw new NotFoundException(
        `Project ${dto.projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.dbNamespace,
    );

    // Create task in project database
    return projectClient.task.create({
      data: {
        sprintId: dto.sprintId,
        createdBy: dto.createdBy,
        title: dto.title,
        description: dto.description,
        statusId: dto.state,
        priority: dto.priority === 'low' ? 1 : dto.priority === 'medium' ? 2 : dto.priority === 'high' ? 3 : 4,
        dueAt: dto.dueDate,
        assignedTo: dto.assignedTo,
      },
      select: {
        id: true,
        sprintId: true,
        createdBy: true,
        title: true,
        description: true,
        statusId: true,
        priority: true,
        dueAt: true,
        assignedTo: true,
        createdAt: true,
        updatedAt: true,
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

    // Fetch tasks from project database
    return projectClient.task.findMany({
      select: {
        id: true,
        sprintId: true,
        createdBy: true,
        title: true,
        description: true,
        statusId: true,
        priority: true,
        dueAt: true,
        assignedTo: true,
        createdAt: true,
        updatedAt: true,
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

    // Fetch task from project database
    const task = await projectClient.task.findUnique({
      where: { id },
      select: {
        id: true,
        sprintId: true,
        createdBy: true,
        title: true,
        description: true,
        statusId: true,
        priority: true,
        dueAt: true,
        assignedTo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found in project ${projectId}`);
    }

    return task;
  }
}
