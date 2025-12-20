import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { UsersService } from '../users/users.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { eq, inArray, and, ne, isNull } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';

@Injectable()
export class SprintsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly users: UsersService,
  ) {}

  async create(projectId: string, dto: CreateSprintDto, userId: string) {
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

    // Find status by name
    const status = await projectClient
      .select()
      .from(projectSchema.statuses)
      .where(
        and(
          eq(projectSchema.statuses.name, dto.state),
          eq(projectSchema.statuses.typeId, 1) // Sprint status
        )
      );

    if (!status || status.length === 0) {
      throw new BadRequestException(
        `Sprint status "${dto.state}" not found`,
      );
    }

    // Create sprint in project database
    const result = await projectClient
      .insert(projectSchema.sprints)
      .values({
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        statusId: status[0].id,
      })
      .returning({
        id: projectSchema.sprints.id,
        name: projectSchema.sprints.name,
        startDate: projectSchema.sprints.startDate,
        endDate: projectSchema.sprints.endDate,
        statusId: projectSchema.sprints.statusId,
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

    // Fetch sprints from project database
    return projectClient
      .select({
        id: projectSchema.sprints.id,
        name: projectSchema.sprints.name,
        startDate: projectSchema.sprints.startDate,
        endDate: projectSchema.sprints.endDate,
        statusId: projectSchema.sprints.statusId,
      })
      .from(projectSchema.sprints);
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

    // Fetch sprint from project database
    const sprint = await projectClient
      .select({
        id: projectSchema.sprints.id,
        name: projectSchema.sprints.name,
        startDate: projectSchema.sprints.startDate,
        endDate: projectSchema.sprints.endDate,
        statusId: projectSchema.sprints.statusId,
      })
      .from(projectSchema.sprints)
      .where(eq(projectSchema.sprints.id, id));

    if (!sprint || sprint.length === 0) {
      throw new NotFoundException(
        `Sprint ${id} not found in project ${projectId}`,
      );
    }

    return sprint[0];
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateSprintDto,
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

    const sprint = await projectClient
      .select()
      .from(projectSchema.sprints)
      .where(eq(projectSchema.sprints.id, id));

    if (!sprint || sprint.length === 0) {
      throw new NotFoundException(
        `Sprint ${id} not found in project ${projectId}`,
      );
    }

    const result = await projectClient
      .update(projectSchema.sprints)
      .set({
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      })
      .where(eq(projectSchema.sprints.id, id))
      .returning({
        id: projectSchema.sprints.id,
        name: projectSchema.sprints.name,
        startDate: projectSchema.sprints.startDate,
        endDate: projectSchema.sprints.endDate,
        statusId: projectSchema.sprints.statusId,
      });

    return result[0];
  }

  async startSprint(projectId: string, sprintId: string, userId: string) {
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

    // Check if sprint exists
    const sprint = await projectClient
      .select()
      .from(projectSchema.sprints)
      .where(eq(projectSchema.sprints.id, sprintId))
      .leftJoin(projectSchema.statuses, eq(projectSchema.sprints.statusId, projectSchema.statuses.id));

    if (!sprint || sprint.length === 0) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    // Check if there's already an active sprint (find by 'Active' status name, typeId 1)
    const activeSprints = await projectClient
      .select()
      .from(projectSchema.sprints)
      .leftJoin(projectSchema.statuses, eq(projectSchema.sprints.statusId, projectSchema.statuses.id))
      .where(and(
        ne(projectSchema.sprints.id, sprintId),
        eq(projectSchema.statuses.name, 'Active'),
        eq(projectSchema.statuses.typeId, 1)
      ));

    if (activeSprints && activeSprints.length > 0) {
      throw new BadRequestException(
        'There is already an active sprint. Complete it before starting a new one.',
      );
    }

    // Find "Active" status (typeId 1 = Sprint Status)
    const activeStatus = await projectClient
      .select()
      .from(projectSchema.statuses)
      .where(
        and(
          eq(projectSchema.statuses.name, 'Active'),
          eq(projectSchema.statuses.typeId, 1)
        )
      );

    if (!activeStatus || activeStatus.length === 0) {
      throw new NotFoundException('Active status not found for sprints');
    }

    // Update sprint status to Active
    const result = await projectClient
      .update(projectSchema.sprints)
      .set({ statusId: activeStatus[0].id })
      .where(eq(projectSchema.sprints.id, sprintId))
      .returning({
        id: projectSchema.sprints.id,
        name: projectSchema.sprints.name,
        startDate: projectSchema.sprints.startDate,
        endDate: projectSchema.sprints.endDate,
        statusId: projectSchema.sprints.statusId,
      });

    return {
      ...result[0],
      status: {
        id: activeStatus[0].id,
        name: activeStatus[0].name,
      },
    };
  }

  async completeSprint(projectId: string, sprintId: string, userId: string) {
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

    const sprint = await projectClient
      .select()
      .from(projectSchema.sprints)
      .where(eq(projectSchema.sprints.id, sprintId));

    if (!sprint || sprint.length === 0) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    // Find "Completed" status for sprint (typeId 1 = Sprint Status)
    const completedStatus = await projectClient
      .select()
      .from(projectSchema.statuses)
      .where(
        and(
          eq(projectSchema.statuses.name, 'Completed'),
          eq(projectSchema.statuses.typeId, 1)
        )
      );

    if (!completedStatus || completedStatus.length === 0) {
      throw new NotFoundException('Completed status not found for sprints');
    }

    // Get all sprint tasks with their status/column info
    const sprintTasks = await projectClient
      .select()
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.sprintId, sprintId))
      .leftJoin(projectSchema.statuses, eq(projectSchema.tasks.statusId, projectSchema.statuses.id))
      .leftJoin(projectSchema.columns, eq(projectSchema.statuses.columnId, projectSchema.columns.id));

    // Move incomplete tasks to backlog (remove sprintId if not in Done column)
    const incompleteTasks = sprintTasks
      .filter((t) => t.columns?.name !== 'Done')
      .map((t) => t.tasks.id);

    if (incompleteTasks.length > 0) {
      await projectClient
        .update(projectSchema.tasks)
        .set({ sprintId: null })
        .where(inArray(projectSchema.tasks.id, incompleteTasks));
    }

    // Update sprint status to Completed
    const result = await projectClient
      .update(projectSchema.sprints)
      .set({ statusId: completedStatus[0].id })
      .where(eq(projectSchema.sprints.id, sprintId))
      .returning({
        id: projectSchema.sprints.id,
        name: projectSchema.sprints.name,
        startDate: projectSchema.sprints.startDate,
        endDate: projectSchema.sprints.endDate,
        statusId: projectSchema.sprints.statusId,
      });

    return {
      ...result[0],
      status: {
        id: completedStatus[0].id,
        name: completedStatus[0].name,
      },
    };
  }

  async getSprintStatistics(projectId: string, sprintId: string) {
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

    const sprintData = await projectClient
      .select()
      .from(projectSchema.sprints)
      .where(eq(projectSchema.sprints.id, sprintId))
      .leftJoin(projectSchema.statuses, eq(projectSchema.sprints.statusId, projectSchema.statuses.id));

    if (!sprintData || sprintData.length === 0) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    const sprint = sprintData[0];

    // Get all tasks for this sprint with their status/column info
    const sprintTasks = await projectClient
      .select()
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.sprintId, sprintId))
      .leftJoin(projectSchema.statuses, eq(projectSchema.tasks.statusId, projectSchema.statuses.id))
      .leftJoin(projectSchema.columns, eq(projectSchema.statuses.columnId, projectSchema.columns.id));

    const totalTasks = sprintTasks.length;
    const completedTasks = sprintTasks.filter((t) => t.columns?.name === 'Done').length;
    const inProgressTasks = sprintTasks.filter((t) => t.columns?.name === 'In Progress').length;
    const todoTasks = sprintTasks.filter((t) => t.columns?.name === 'To Do').length;

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

    return {
      sprint_id: sprint.sprints.id,
      sprint_name: sprint.sprints.name,
      status: sprint.statuses?.name || 'Unknown',
      start_date: sprint.sprints.startDate,
      end_date: sprint.sprints.endDate,
      statistics: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        todo_tasks: todoTasks,
        completion_rate: completionRate,
      },
    };
  }

  async getSprintView(projectId: string, sprintId: string) {
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

    const sprintData = await projectClient
      .select()
      .from(projectSchema.sprints)
      .where(eq(projectSchema.sprints.id, sprintId))
      .leftJoin(projectSchema.statuses, eq(projectSchema.sprints.statusId, projectSchema.statuses.id));

    if (!sprintData || sprintData.length === 0) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    const sprint = sprintData[0];

    // Get all columns with their statuses
    const allColumns = await projectClient
      .select()
      .from(projectSchema.columns)
      .orderBy(projectSchema.columns.order);

    // Get all tasks for this sprint with labels
    const sprintTasks = await projectClient
      .select()
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.sprintId, sprintId))
      .leftJoin(projectSchema.statuses, eq(projectSchema.tasks.statusId, projectSchema.statuses.id))
      .leftJoin(projectSchema.columns, eq(projectSchema.statuses.columnId, projectSchema.columns.id));

    // Get task labels
    const taskLabels = await projectClient
      .select()
      .from(projectSchema.taskLabels)
      .leftJoin(projectSchema.labels, eq(projectSchema.taskLabels.labelId, projectSchema.labels.id));

    // Get user info for assigned tasks
    const assignedUserIds = [
      ...new Set(
        sprintTasks
          .map((t) => t.tasks.assignedTo)
          .filter((id) => id !== null),
      ),
    ];

    const users = (await this.users.findAll().catch(() => [])) || [];
    const userMap = new Map<string, any>(
      users.map((u: any) => [u.id, u]) as [string, any][]
    );

    // Get status-task mapping
    const statuses = await projectClient
      .select()
      .from(projectSchema.statuses)
      .where(eq(projectSchema.statuses.typeId, 2)); // Task status type

    // Build board with columns and tasks
    const board = allColumns.map((col) => {
      const columnStatuses = statuses.filter((s) => s.columnId === col.id);
      const columnTasks = sprintTasks.filter((t) =>
        columnStatuses.some((s) => s.id === t.tasks.statusId)
      );

      return {
        column_id: col.id,
        column_name: col.name,
        column_order: col.order,
        tasks: columnTasks.map((t) => {
          const taskTaskLabels = taskLabels.filter((tl) => tl.tasklabels?.taskId === t.tasks.id);
          
          return {
            task_id: t.tasks.id,
            title: t.tasks.title,
            description: t.tasks.description,
            priority: t.tasks.priority,
            due_at: t.tasks.dueAt,
            estimate: t.tasks.estimate,
            status_id: t.tasks.statusId,
            status_name: t.statuses?.name || 'Unknown',
            assigned_to: t.tasks.assignedTo
              ? {
                  user_id: t.tasks.assignedTo,
                  name: userMap.get(t.tasks.assignedTo)?.['name'] || null,
                  email: userMap.get(t.tasks.assignedTo)?.['email'] || null,
                }
              : null,
            labels: taskTaskLabels
              .filter((tl) => tl.labels !== null)
              .map((tl) => ({
                label_id: tl.labels!.id,
                name: tl.labels!.name,
                color: tl.labels!.color,
              })),
            created_at: t.tasks.createdAt,
            updated_at: t.tasks.updatedAt,
          };
        }),
      };
    });

    // Calculate statistics
    const totalTasks = sprintTasks.length;
    const completedTasks = sprintTasks.filter((t) => t.columns?.name === 'Done').length;
    const inProgressTasks = sprintTasks.filter((t) => t.columns?.name === 'In Progress').length;
    const todoTasks = sprintTasks.filter((t) => t.columns?.name === 'To Do').length;

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

    return {
      sprint: {
        sprint_id: sprint.sprints.id,
        name: sprint.sprints.name,
        status: sprint.statuses?.name || 'Unknown',
        start_date: sprint.sprints.startDate,
        end_date: sprint.sprints.endDate,
        statistics: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          in_progress_tasks: inProgressTasks,
          todo_tasks: todoTasks,
          completion_rate: completionRate,
        },
      },
      board,
    };
  }
}
