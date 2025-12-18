import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(projectId: string, dto: CreateTaskDto, createdBy: string) {
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

    // Create task in project database
    return projectClient.task.create({
      data: {
        sprintId: dto.sprintId,
        createdBy: createdBy,
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

  async update(
    projectId: string,
    id: string,
    dto: UpdateTaskDto,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { dbNamespace: true },
    });

    if (!project || !project.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.projectDb.getProjectClient(
      project.dbNamespace,
    );

    const task = await projectClient.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(
        `Task ${id} not found in project ${projectId}`,
      );
    }

    // Check if task is archived
    if (task.archived) {
      throw new BadRequestException(
        'Cannot update archived task',
      );
    }

    return projectClient.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        assignedTo: dto.assignedTo,
        estimate: dto.estimate,
        statusId: dto.statusId,
        sprintId: dto.sprintId,
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
        estimate: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async softDelete(
    projectId: string,
    id: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { dbNamespace: true },
    });

    if (!project || !project.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.projectDb.getProjectClient(
      project.dbNamespace,
    );

    const task = await projectClient.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(
        `Task ${id} not found in project ${projectId}`,
      );
    }

    if (task.archived) {
      throw new BadRequestException(
        'Task is already archived',
      );
    }

    await projectClient.task.update({
      where: { id },
      data: {
        archived: true,
      },
    });

    return {
      message: 'Task archived successfully',
      task_id: id,
    };
  }

  async changeStatus(
    projectId: string,
    taskId: string,
    newStatusId: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { dbNamespace: true },
    });

    if (!project || !project.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.projectDb.getProjectClient(
      project.dbNamespace,
    );

    // Get current task with status
    const task = await projectClient.task.findUnique({
      where: { id: taskId },
      include: {
        status: true,
      },
    });

    if (!task) {
      throw new NotFoundException(
        `Task ${taskId} not found in project ${projectId}`,
      );
    }

    if (task.archived) {
      throw new BadRequestException(
        'Cannot change status of archived task',
      );
    }

    // Get new status
    const newStatus = await projectClient.status.findUnique({
      where: { id: newStatusId },
    });

    if (!newStatus) {
      throw new NotFoundException(
        `Status ${newStatusId} not found`,
      );
    }

    // Check if transition is allowed
    const allowedTransition = await projectClient.statusTransition.findFirst({
      where: {
        fromStatus: task.statusId,
        toStatusId: newStatusId,
      },
    });

    if (!allowedTransition && task.statusId !== newStatusId) {
      throw new BadRequestException(
        `Transition from '${task.status?.name || 'Unknown'}' to '${newStatus.name}' is not allowed`,
      );
    }

    // Update task status
    return projectClient.task.update({
      where: { id: taskId },
      data: {
        statusId: newStatusId,
      },
      select: {
        id: true,
        title: true,
        statusId: true,
        status: {
          select: {
            id: true,
            name: true,
            columnId: true,
            column: {
              select: {
                id: true,
                name: true,
                order: true,
              },
            },
          },
        },
        updatedAt: true,
      },
    });
  }
}
