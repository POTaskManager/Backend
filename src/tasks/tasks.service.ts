import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { eq } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';

@Injectable()
export class TasksService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(projectId: string, dto: CreateTaskDto, createdBy: string) {
    // Get project to find namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (!project || !project[0]?.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Create task in project database
    const result = await projectClient
      .insert(projectSchema.tasks)
      .values({
        sprintId: dto.sprintId,
        createdBy: createdBy,
        title: dto.title,
        description: dto.description,
        statusId: dto.state,
        priority: dto.priority === 'low' ? 1 : dto.priority === 'medium' ? 2 : dto.priority === 'high' ? 3 : 4,
        dueAt: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedTo: dto.assignedTo,
        archived: false,
      })
      .returning({
        id: projectSchema.tasks.id,
        sprintId: projectSchema.tasks.sprintId,
        createdBy: projectSchema.tasks.createdBy,
        title: projectSchema.tasks.title,
        description: projectSchema.tasks.description,
        statusId: projectSchema.tasks.statusId,
        priority: projectSchema.tasks.priority,
        dueAt: projectSchema.tasks.dueAt,
        assignedTo: projectSchema.tasks.assignedTo,
        createdAt: projectSchema.tasks.createdAt,
        updatedAt: projectSchema.tasks.updatedAt,
      });

    return result[0];
  }

  async findAll(projectId: string) {
    // Get project to find namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (!project || !project[0]?.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Fetch tasks from project database
    return projectClient
      .select({
        id: projectSchema.tasks.id,
        sprintId: projectSchema.tasks.sprintId,
        createdBy: projectSchema.tasks.createdBy,
        title: projectSchema.tasks.title,
        description: projectSchema.tasks.description,
        statusId: projectSchema.tasks.statusId,
        priority: projectSchema.tasks.priority,
        dueAt: projectSchema.tasks.dueAt,
        assignedTo: projectSchema.tasks.assignedTo,
        createdAt: projectSchema.tasks.createdAt,
        updatedAt: projectSchema.tasks.updatedAt,
      })
      .from(projectSchema.tasks);
  }

  async findOne(projectId: string, id: string) {
    // Get project to find namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (!project || !project[0]?.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Fetch task from project database
    const task = await projectClient
      .select({
        id: projectSchema.tasks.id,
        sprintId: projectSchema.tasks.sprintId,
        createdBy: projectSchema.tasks.createdBy,
        title: projectSchema.tasks.title,
        description: projectSchema.tasks.description,
        statusId: projectSchema.tasks.statusId,
        priority: projectSchema.tasks.priority,
        dueAt: projectSchema.tasks.dueAt,
        assignedTo: projectSchema.tasks.assignedTo,
        createdAt: projectSchema.tasks.createdAt,
        updatedAt: projectSchema.tasks.updatedAt,
      })
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.id, id));

    if (!task || task.length === 0) {
      throw new NotFoundException(`Task ${id} not found in project ${projectId}`);
    }

    return task[0];
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateTaskDto,
    userId: string,
  ) {
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (!project || !project[0]?.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.drizzle.getProjectDb(project[0].dbNamespace);

    const task = await projectClient
      .select()
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.id, id));

    if (!task || task.length === 0) {
      throw new NotFoundException(
        `Task ${id} not found in project ${projectId}`,
      );
    }

    // Check if task is archived
    if (task[0].archived) {
      throw new BadRequestException(
        'Cannot update archived task',
      );
    }

    // Validate status transition if statusId is being changed
    if (dto.statusId !== undefined && dto.statusId !== task[0].statusId) {
      // Get new status
      const newStatusArray = await projectClient
        .select()
        .from(projectSchema.statuses)
        .where(eq(projectSchema.statuses.id, dto.statusId));

      if (!newStatusArray || newStatusArray.length === 0) {
        throw new NotFoundException(
          `Status ${dto.statusId} not found`,
        );
      }

      const newStatus = newStatusArray[0];

      // Check if transition is allowed (only if current status exists)
      let isTransitionAllowed = task[0].statusId === dto.statusId;
      
      if (!isTransitionAllowed && task[0].statusId) {
        const allowedTransitions = await projectClient
          .select()
          .from(projectSchema.statusTransitions)
          .where(
            eq(projectSchema.statusTransitions.fromStatusId, task[0].statusId as string)
          );

        isTransitionAllowed = allowedTransitions.some((t) => t.toStatusId === dto.statusId);
      } else if (!isTransitionAllowed) {
        isTransitionAllowed = true; // Allow transition from null status
      }

      if (!isTransitionAllowed && task[0].statusId !== dto.statusId) {
        // Get current status name for better error message
        const currentStatusArray = await projectClient
          .select()
          .from(projectSchema.statuses)
          .where(eq(projectSchema.statuses.id, task[0].statusId as string));

        const currentStatusName = currentStatusArray[0]?.name || 'Unknown';
        
        throw new BadRequestException(
          `Transition from '${currentStatusName}' to '${newStatus.name}' is not allowed`,
        );
      }
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.dueAt !== undefined) updateData.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.assignedTo !== undefined) updateData.assignedTo = dto.assignedTo;
    if (dto.statusId !== undefined) updateData.statusId = dto.statusId;
    if (dto.sprintId !== undefined) updateData.sprintId = dto.sprintId;
    if (dto.estimate !== undefined) updateData.estimate = dto.estimate;
    updateData.updatedAt = new Date();

    const result = await projectClient
      .update(projectSchema.tasks)
      .set(updateData)
      .where(eq(projectSchema.tasks.id, id))
      .returning({
        id: projectSchema.tasks.id,
        sprintId: projectSchema.tasks.sprintId,
        createdBy: projectSchema.tasks.createdBy,
        title: projectSchema.tasks.title,
        description: projectSchema.tasks.description,
        statusId: projectSchema.tasks.statusId,
        priority: projectSchema.tasks.priority,
        dueAt: projectSchema.tasks.dueAt,
        assignedTo: projectSchema.tasks.assignedTo,
        estimate: projectSchema.tasks.estimate,
        archived: projectSchema.tasks.archived,
        createdAt: projectSchema.tasks.createdAt,
        updatedAt: projectSchema.tasks.updatedAt,
      });

    return result[0];
  }

  async softDelete(
    projectId: string,
    id: string,
    userId: string,
  ) {
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (!project || !project[0]?.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.drizzle.getProjectDb(project[0].dbNamespace);

    const task = await projectClient
      .select()
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.id, id));

    if (!task || task.length === 0) {
      throw new NotFoundException(
        `Task ${id} not found in project ${projectId}`,
      );
    }

    if (task[0].archived) {
      throw new BadRequestException(
        'Task is already archived',
      );
    }

    await projectClient
      .update(projectSchema.tasks)
      .set({ archived: true })
      .where(eq(projectSchema.tasks.id, id));

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
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (!project || !project[0]?.dbNamespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    const projectClient = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Get current task with status
    const tasks = await projectClient
      .select()
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.id, taskId))
      .leftJoin(projectSchema.statuses, eq(projectSchema.tasks.statusId, projectSchema.statuses.id));

    if (!tasks || tasks.length === 0) {
      throw new NotFoundException(
        `Task ${taskId} not found in project ${projectId}`,
      );
    }

    const task = tasks[0];

    if (task.tasks.archived) {
      throw new BadRequestException(
        'Cannot change status of archived task',
      );
    }

    // Get new status
    const newStatusArray = await projectClient
      .select()
      .from(projectSchema.statuses)
      .where(eq(projectSchema.statuses.id, newStatusId));

    if (!newStatusArray || newStatusArray.length === 0) {
      throw new NotFoundException(
        `Status ${newStatusId} not found`,
      );
    }

    const newStatus = newStatusArray[0];

    // Check if transition is allowed (only if current status exists)
    let isTransitionAllowed = task.tasks.statusId === newStatusId;
    
    if (!isTransitionAllowed && task.tasks.statusId) {
      const allowedTransitions = await projectClient
        .select()
        .from(projectSchema.statusTransitions)
        .where(
          eq(projectSchema.statusTransitions.fromStatusId, task.tasks.statusId as string)
        );

      isTransitionAllowed = allowedTransitions.some((t) => t.toStatusId === newStatusId);
    } else if (!isTransitionAllowed) {
      isTransitionAllowed = true; // Allow transition from null status
    }

    if (!isTransitionAllowed && task.tasks.statusId !== newStatusId) {
      throw new BadRequestException(
        `Transition from '${task.statuses?.name || 'Unknown'}' to '${newStatus.name}' is not allowed`,
      );
    }

    // Update task status
    const result = await projectClient
      .update(projectSchema.tasks)
      .set({ statusId: newStatusId })
      .where(eq(projectSchema.tasks.id, taskId))
      .returning({
        id: projectSchema.tasks.id,
        title: projectSchema.tasks.title,
        statusId: projectSchema.tasks.statusId,
        updatedAt: projectSchema.tasks.updatedAt,
      });

    // Return with status object
    return {
      ...result[0],
      status: {
        id: newStatus.id,
        name: newStatus.name,
      },
    };
  }
}
