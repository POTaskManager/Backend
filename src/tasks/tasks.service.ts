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
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: dto.projectId },
      select: { proj_db_namespace: true },
    });

    if (!project || !project.proj_db_namespace) {
      throw new NotFoundException(
        `Project ${dto.projectId} not found or has no database`,
      );
    }

    // Get project-specific client
    const projectClient = await this.projectDb.getProjectClient(
      project.proj_db_namespace,
    );

    // Create task in project database
    return projectClient.tasks.create({
      data: {
        task_sprintid: dto.sprintId,
        task_created_by: dto.createdBy,
        task_title: dto.title,
        task_description: dto.description,
        task_statusid: dto.state,
        task_priority: dto.priority === 'low' ? 1 : dto.priority === 'medium' ? 2 : dto.priority === 'high' ? 3 : 4,
        task_due_at: dto.dueDate,
        task_assigned_to: dto.assignedTo,
      },
      select: {
        task_taskid: true,
        task_sprintid: true,
        task_created_by: true,
        task_title: true,
        task_description: true,
        task_statusid: true,
        task_priority: true,
        task_due_at: true,
        task_assigned_to: true,
        task_created_at: true,
        task_updated_at: true,
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

    // Fetch tasks from project database
    return projectClient.tasks.findMany({
      select: {
        task_taskid: true,
        task_sprintid: true,
        task_created_by: true,
        task_title: true,
        task_description: true,
        task_statusid: true,
        task_priority: true,
        task_due_at: true,
        task_assigned_to: true,
        task_created_at: true,
        task_updated_at: true,
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

    // Fetch task from project database
    const task = await projectClient.tasks.findUnique({
      where: { task_taskid: id },
      select: {
        task_taskid: true,
        task_sprintid: true,
        task_created_by: true,
        task_title: true,
        task_description: true,
        task_statusid: true,
        task_priority: true,
        task_due_at: true,
        task_assigned_to: true,
        task_created_at: true,
        task_updated_at: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found in project ${projectId}`);
    }

    return task;
  }
}
