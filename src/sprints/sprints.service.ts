import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(projectId: string, dto: CreateSprintDto, userId: string) {
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

    // Find status by name
    const status = await projectClient.status.findFirst({
      where: {
        name: dto.state,
        typeId: 1, // Sprint status
      },
    });

    if (!status) {
      throw new BadRequestException(
        `Sprint status "${dto.state}" not found`,
      );
    }

    // Create sprint in project database
    return projectClient.sprint.create({
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        statusId: status.id,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        statusId: true,
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

    // Fetch sprints from project database
    return projectClient.sprint.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        statusId: true,
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

    // Fetch sprint from project database
    const sprint = await projectClient.sprint.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        statusId: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${id} not found in project ${projectId}`,
      );
    }

    return sprint;
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateSprintDto,
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

    const sprint = await projectClient.sprint.findUnique({
      where: { id },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${id} not found in project ${projectId}`,
      );
    }

    return projectClient.sprint.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        statusId: true,
      },
    });
  }

  async startSprint(projectId: string, sprintId: string, userId: string) {
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

    // Check if sprint exists
    const sprint = await projectClient.sprint.findUnique({
      where: { id: sprintId },
      include: { status: true },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    // Check if there's already an active sprint
    const activeSprint = await projectClient.sprint.findFirst({
      where: {
        status: {
          name: 'Active',
        },
      },
    });

    if (activeSprint && activeSprint.id !== sprintId) {
      throw new BadRequestException(
        'There is already an active sprint. Complete it before starting a new one.',
      );
    }

    // Find "Active" status
    const activeStatus = await projectClient.status.findFirst({
      where: { name: 'Active', typeId: 2 }, // 2 = In Progress
    });

    if (!activeStatus) {
      throw new NotFoundException('Active status not found for sprints');
    }

    // Update sprint status to Active
    return projectClient.sprint.update({
      where: { id: sprintId },
      data: {
        statusId: activeStatus.id,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        statusId: true,
        status: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async completeSprint(projectId: string, sprintId: string, userId: string) {
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

    const sprint = await projectClient.sprint.findUnique({
      where: { id: sprintId },
      include: {
        status: true,
        tasks: {
          include: {
            status: {
              include: {
                column: true,
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    // Find "Completed" status for sprint
    const completedStatus = await projectClient.status.findFirst({
      where: { name: 'Completed', typeId: 1 }, // 1 = Sprint Status
    });

    if (!completedStatus) {
      throw new NotFoundException('Completed status not found for sprints');
    }

    // Move incomplete tasks to backlog (remove sprintId)
    const incompleteTasks = sprint.tasks.filter(
      (task) => task.status && task.status.column && task.status.column.name !== 'Done',
    );

    if (incompleteTasks.length > 0) {
      await projectClient.task.updateMany({
        where: {
          id: {
            in: incompleteTasks.map((t) => t.id),
          },
        },
        data: {
          sprintId: null,
        },
      });
    }

    // Update sprint status to Completed
    return projectClient.sprint.update({
      where: { id: sprintId },
      data: {
        statusId: completedStatus.id,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        statusId: true,
        status: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });
  }

  async getSprintStatistics(projectId: string, sprintId: string) {
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

    const sprint = await projectClient.sprint.findUnique({
      where: { id: sprintId },
      include: {
        status: true,
        tasks: {
          include: {
            status: {
              include: {
                column: true,
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter(
      (task) => task.status?.column?.name === 'Done',
    ).length;
    const inProgressTasks = sprint.tasks.filter(
      (task) => task.status?.column?.name === 'In Progress',
    ).length;
    const todoTasks = sprint.tasks.filter(
      (task) => task.status?.column?.name === 'To Do',
    ).length;

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

    return {
      sprint_id: sprint.id,
      sprint_name: sprint.name,
      status: sprint.status?.name || 'Unknown',
      start_date: sprint.startDate,
      end_date: sprint.endDate,
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

    const sprint = await projectClient.sprint.findUnique({
      where: { id: sprintId },
      include: {
        status: true,
        tasks: {
          include: {
            status: {
              include: {
                column: true,
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${sprintId} not found in project ${projectId}`,
      );
    }

    // Get board columns
    const columns = await projectClient.column.findMany({
      orderBy: { order: 'asc' },
      include: {
        statuses: {
          include: {
            tasks: {
              where: {
                sprintId: sprintId,
              },
              include: {
                status: true,
                labels: {
                  include: {
                    label: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get user info for assigned tasks
    const assignedUserIds = [
      ...new Set(
        columns
          .flatMap((col) => col.statuses)
          .flatMap((status) => status.tasks)
          .map((task) => task.assignedTo)
          .filter((id) => id !== null),
      ),
    ];

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: assignedUserIds as string[] },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Calculate statistics
    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter(
      (task) => task.status?.column?.name === 'Done',
    ).length;
    const inProgressTasks = sprint.tasks.filter(
      (task) => task.status?.column?.name === 'In Progress',
    ).length;
    const todoTasks = sprint.tasks.filter(
      (task) => task.status?.column?.name === 'To Do',
    ).length;

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

    // Format board data
    const board = columns.map((col) => ({
      column_id: col.id,
      column_name: col.name,
      column_order: col.order,
      tasks: col.statuses
        .flatMap((status) => status.tasks)
        .map((task) => ({
          task_id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_at: task.dueAt,
          estimate: task.estimate,
          status_id: task.statusId,
          status_name: task.status?.name || 'Unknown',
          assigned_to: task.assignedTo
            ? {
                user_id: task.assignedTo,
                name: userMap.get(task.assignedTo)?.name || null,
                email: userMap.get(task.assignedTo)?.email || null,
              }
            : null,
          labels: task.labels
            .filter((tl) => tl.label !== null)
            .map((tl) => ({
              label_id: tl.label!.id,
              name: tl.label!.name,
              color: tl.label!.color,
            })),
          created_at: task.createdAt,
          updated_at: task.updatedAt,
        })),
    }));

    return {
      sprint: {
        sprint_id: sprint.id,
        name: sprint.name,
        status: sprint.status?.name || 'Unknown',
        start_date: sprint.startDate,
        end_date: sprint.endDate,
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
