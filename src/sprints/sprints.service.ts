import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto, MoveIncompleteTo } from './dto/complete-sprint.dto';
import { SprintQueryDto } from './dto/sprint-query.dto';

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  private async checkUserPermissions(
    projectId: string,
    userId: string,
    requiredRoles: string[] = ['owner', 'admin'],
  ): Promise<void> {
    const access = await this.prisma.projectaccess.findFirst({
      where: {
        pac_projectid: projectId,
        pac_userid: userId,
        pac_role: { in: requiredRoles },
      },
    });

    if (!access) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
  }

  private async getProjectClient(projectId: string) {
    const project = await this.prisma.projects.findUnique({
      where: { proj_projid: projectId },
      select: { proj_db_namespace: true },
    });

    if (!project || !project.proj_db_namespace) {
      throw new NotFoundException(
        `Project ${projectId} not found or has no database`,
      );
    }

    return this.projectDb.getProjectClient(project.proj_db_namespace);
  }

  async create(projectId: string, userId: string, dto: CreateSprintDto) {
    // Check permissions: only Owner/Admin
    await this.checkUserPermissions(projectId, userId, ['owner', 'admin']);

    const projectClient = await this.getProjectClient(projectId);

    // Validate dates
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (end <= start) {
        throw new BadRequestException(
          'End date must be later than start date',
        );
      }
    }

    // Check for overlapping active sprints
    if (dto.startDate && dto.endDate) {
      const activeStatus = await projectClient.statuses.findFirst({
        where: { stat_name: 'Active', stat_typeid: 1 },
      });

      if (activeStatus) {
        const overlapping = await projectClient.sprints.count({
          where: {
            spr_statusid: activeStatus.stat_statusid,
            OR: [
              {
                AND: [
                  { spr_start_date: { lte: new Date(dto.startDate) } },
                  { spr_end_date: { gte: new Date(dto.startDate) } },
                ],
              },
              {
                AND: [
                  { spr_start_date: { lte: new Date(dto.endDate) } },
                  { spr_end_date: { gte: new Date(dto.endDate) } },
                ],
              },
              {
                AND: [
                  { spr_start_date: { gte: new Date(dto.startDate) } },
                  { spr_end_date: { lte: new Date(dto.endDate) } },
                ],
              },
            ],
          },
        });

        if (overlapping > 0) {
          throw new BadRequestException(
            'Sprint dates overlap with an active sprint',
          );
        }
      }
    }

    // Get "Planning" status
    const planningStatus = await projectClient.statuses.findFirst({
      where: { stat_name: 'Planning', stat_typeid: 1 },
    });

    if (!planningStatus) {
      throw new BadRequestException(
        'Planning status not found in project database',
      );
    }

    // Create sprint
    const sprint = await projectClient.sprints.create({
      data: {
        spr_name: dto.name,
        spr_goal: dto.goal,
        spr_start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        spr_end_date: dto.endDate ? new Date(dto.endDate) : undefined,
        spr_statusid: planningStatus.stat_statusid,
        spr_created_by: userId,
        spr_velocity: 0,
      },
    });

    // Assign tasks if provided
    if (dto.taskIds && dto.taskIds.length > 0) {
      await projectClient.tasks.updateMany({
        where: { task_taskid: { in: dto.taskIds } },
        data: { task_sprintid: sprint.spr_sprintid },
      });
    }



    // Get task count
    const taskCount = await projectClient.tasks.count({
      where: { task_sprintid: sprint.spr_sprintid },
    });

    // Get created_by user details
    const createdBy = await this.prisma.users.findUnique({
      where: { user_userid: userId },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
      },
    });

    return {
      sprint_id: sprint.spr_sprintid,
      name: sprint.spr_name,
      goal: sprint.spr_goal,
      start_date: sprint.spr_start_date,
      end_date: sprint.spr_end_date,
      status: {
        status_id: planningStatus.stat_statusid,
        name: planningStatus.stat_name,
      },
      task_count: taskCount,
      velocity: sprint.spr_velocity,
      created_by: createdBy
        ? {
            user_id: createdBy.user_userid,
            name: createdBy.user_name,
            email: createdBy.user_email,
          }
        : null,
      created_at: sprint.spr_created_at,
    };
  }

  async findAll(projectId: string, queryDto: SprintQueryDto) {
    const projectClient = await this.getProjectClient(projectId);

    // Build where clause
    const where: any = {};
    if (queryDto.status) {
      const status = await projectClient.statuses.findFirst({
        where: { stat_name: queryDto.status, stat_typeid: 1 },
      });
      if (status) {
        where.spr_statusid = status.stat_statusid;
      }
    }

    // Get total count
    const total = await projectClient.sprints.count({ where });

    // Fetch sprints with pagination
    const sprints = await projectClient.sprints.findMany({
      where,
      take: queryDto.limit || 20,
      skip: queryDto.offset || 0,
      orderBy: { spr_start_date: 'desc' },
      include: {
        statuses: {
          select: {
            stat_statusid: true,
            stat_name: true,
          },
        },
        tasks: {
          select: {
            task_taskid: true,
            statuses: {
              select: {
                stat_typeid: true,
                columns: {
                  select: {
                    col_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get unique created_by user IDs
    const userIds = new Set<string>();
    sprints.forEach((sprint) => {
      if (sprint.spr_created_by) {
        userIds.add(sprint.spr_created_by);
      }
    });

    // Fetch user details from globaldb
    const users = await this.prisma.users.findMany({
      where: { user_userid: { in: Array.from(userIds) } },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
      },
    });

    const userMap = new Map(
      users.map((u) => [
        u.user_userid,
        { name: u.user_name, email: u.user_email },
      ]),
    );

    // Format response
    const formattedSprints = sprints.map((sprint) => {
      const totalTasks = sprint.tasks.length;
      const completedTasks = sprint.tasks.filter(
        (t) => t.statuses?.columns?.col_name === 'Done',
      ).length;

      return {
        sprint_id: sprint.spr_sprintid,
        name: sprint.spr_name,
        goal: sprint.spr_goal,
        status: sprint.statuses
          ? {
              status_id: sprint.statuses.stat_statusid,
              name: sprint.statuses.stat_name,
            }
          : null,
        start_date: sprint.spr_start_date,
        end_date: sprint.spr_end_date,
        completed_at: sprint.spr_completed_at,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        velocity: sprint.spr_velocity,
        created_by: sprint.spr_created_by
          ? {
              user_id: sprint.spr_created_by,
              name: userMap.get(sprint.spr_created_by)?.name || 'Unknown',
              email: userMap.get(sprint.spr_created_by)?.email || '',
            }
          : null,
        created_at: sprint.spr_created_at,
      };
    });

    return {
      sprints: formattedSprints,
      pagination: {
        total,
        limit: queryDto.limit || 20,
        offset: queryDto.offset || 0,
      },
    };
  }

  async findOne(projectId: string, id: string) {
    const projectClient = await this.getProjectClient(projectId);

    // Fetch sprint with full details
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: id },
      include: {
        statuses: {
          select: {
            stat_statusid: true,
            stat_name: true,
          },
        },
        tasks: {
          include: {
            statuses: {
              select: {
                stat_statusid: true,
                stat_name: true,
                stat_typeid: true,
                columns: {
                  select: {
                    col_name: true,
                    col_order: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${id} not found in project ${projectId}`,
      );
    }

    // Get user IDs from tasks
    const userIds = new Set<string>();
    if (sprint.spr_created_by) {
      userIds.add(sprint.spr_created_by);
    }
    sprint.tasks.forEach((task) => {
      if (task.task_assigned_to) {
        userIds.add(task.task_assigned_to);
      }
    });

    // Fetch user details from globaldb
    const users = await this.prisma.users.findMany({
      where: { user_userid: { in: Array.from(userIds) } },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
      },
    });

    const userMap = new Map(
      users.map((u) => [
        u.user_userid,
        { name: u.user_name, email: u.user_email },
      ]),
    );

    // Calculate statistics
    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter(
      (t) => t.statuses?.columns?.col_name === 'Done',
    ).length;
    const inProgressTasks = sprint.tasks.filter(
      (t) => t.statuses?.columns?.col_name === 'In Progress',
    ).length;
    const todoTasks = sprint.tasks.filter(
      (t) => t.statuses?.columns?.col_name === 'To Do',
    ).length;

    const totalEstimate = sprint.tasks.reduce(
      (sum, t) => sum + (t.task_estimate || 0),
      0,
    );
    const completedEstimate = sprint.tasks
      .filter((t) => t.statuses?.columns?.col_name === 'Done')
      .reduce((sum, t) => sum + (t.task_estimate || 0), 0);
    const remainingEstimate = totalEstimate - completedEstimate;

    return {
      sprint_id: sprint.spr_sprintid,
      name: sprint.spr_name,
      goal: sprint.spr_goal,
      status: sprint.statuses
        ? {
            status_id: sprint.statuses.stat_statusid,
            name: sprint.statuses.stat_name,
          }
        : null,
      start_date: sprint.spr_start_date,
      end_date: sprint.spr_end_date,
      completed_at: sprint.spr_completed_at,
      velocity: sprint.spr_velocity,
      created_by: sprint.spr_created_by
        ? {
            user_id: sprint.spr_created_by,
            name: userMap.get(sprint.spr_created_by)?.name || 'Unknown',
            email: userMap.get(sprint.spr_created_by)?.email || '',
          }
        : null,
      created_at: sprint.spr_created_at,
      statistics: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        todo_tasks: todoTasks,
        completion_rate:
          totalTasks > 0
            ? Math.round((completedTasks / totalTasks) * 100 * 10) / 10
            : 0,
        total_estimate: totalEstimate,
        completed_estimate: completedEstimate,
        remaining_estimate: remainingEstimate,
      },
      tasks: sprint.tasks.map((task) => ({
        task_id: task.task_taskid,
        title: task.task_title,
        estimate: task.task_estimate,
        status: task.statuses?.stat_name || 'Unknown',
        column: task.statuses?.columns?.col_name || 'Unknown',
        assigned_to: task.task_assigned_to
          ? {
              user_id: task.task_assigned_to,
              name: userMap.get(task.task_assigned_to)?.name || 'Unknown',
              email: userMap.get(task.task_assigned_to)?.email || '',
            }
          : null,
      })),
    };
  }

  async getSprintView(projectId: string, sprintId: string) {
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

    // Fetch sprint with tasks
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: sprintId },
      select: {
        spr_sprintid: true,
        spr_name: true,
        spr_start_date: true,
        spr_end_date: true,
        spr_statusid: true,
        tasks: {
          select: {
            task_taskid: true,
            task_title: true,
            task_description: true,
            task_priority: true,
            task_due_at: true,
            task_created_at: true,
            task_assigned_to: true,
            task_estimate: true,
            statuses: {
              select: {
                stat_statusid: true,
                stat_name: true,
                stat_typeid: true,
              },
            },
            tasklabels: {
              select: {
                labels: {
                  select: {
                    lab_labelid: true,
                    lab_name: true,
                    lab_color: true,
                  },
                },
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

    // Fetch user details from global DB
    const userIds = new Set<string>();
    sprint.tasks.forEach((task) => {
      if (task.task_assigned_to) {
        userIds.add(task.task_assigned_to);
      }
    });

    const users = await this.prisma.users.findMany({
      where: {
        user_userid: { in: Array.from(userIds) },
      },
      select: {
        user_userid: true,
        user_name: true,
        user_email: true,
      },
    });

    const userMap = new Map(
      users.map((u) => [u.user_userid, { name: u.user_name, email: u.user_email }]),
    );

    // Calculate statistics
    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter(
      (t) => t.statuses?.stat_typeid === 3, // Assuming 3 = Done/Completed
    ).length;
    const totalStoryPoints = sprint.tasks.reduce(
      (sum, t) => sum + (t.task_estimate || 0),
      0,
    );
    const completedStoryPoints = sprint.tasks
      .filter((t) => t.statuses?.stat_typeid === 3)
      .reduce((sum, t) => sum + (t.task_estimate || 0), 0);

    // Build response
    return {
      sprint: {
        sprint_id: sprint.spr_sprintid,
        name: sprint.spr_name,
        start_date: sprint.spr_start_date,
        end_date: sprint.spr_end_date,
        status_id: sprint.spr_statusid,
      },
      statistics: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: sprint.tasks.filter(
          (t) => t.statuses?.stat_typeid === 2,
        ).length,
        todo_tasks: sprint.tasks.filter((t) => t.statuses?.stat_typeid === 1)
          .length,
        total_story_points: totalStoryPoints,
        completed_story_points: completedStoryPoints,
        completion_percentage:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      tasks: sprint.tasks.map((task) => ({
        task_id: task.task_taskid,
        title: task.task_title,
        description: task.task_description,
        priority: task.task_priority,
        due_at: task.task_due_at,
        created_at: task.task_created_at,
        estimate: task.task_estimate,
        status: task.statuses
          ? {
              status_id: task.statuses.stat_statusid,
              status_name: task.statuses.stat_name,
              status_type: task.statuses.stat_typeid,
            }
          : null,
        assigned_to: task.task_assigned_to
          ? {
              user_id: task.task_assigned_to,
              name: userMap.get(task.task_assigned_to)?.name || 'Unknown',
              email: userMap.get(task.task_assigned_to)?.email || '',
            }
          : null,
        labels: task.tasklabels
          .filter((tl) => tl.labels)
          .map((tl) => ({
            label_id: tl.labels!.lab_labelid,
            name: tl.labels!.lab_name,
            color: tl.labels!.lab_color,
          })),
      })),
    };
  }

  async start(projectId: string, sprintId: string, userId: string) {
    // Check permissions
    await this.checkUserPermissions(projectId, userId, ['owner', 'admin']);

    const projectClient = await this.getProjectClient(projectId);

    // Get sprint with status
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: sprintId },
      include: {
        statuses: { select: { stat_name: true } },
        tasks: { select: { task_taskid: true } },
      },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    // Validate: must be in Planning status
    if (sprint.statuses?.stat_name !== 'Planning') {
      throw new BadRequestException(
        `Sprint must be in Planning status. Current status: ${sprint.statuses?.stat_name}`,
      );
    }

    // Validate: must have tasks
    if (sprint.tasks.length === 0) {
      throw new BadRequestException(
        'Sprint must have at least one task to start',
      );
    }

    // Check for other active sprints
    const activeStatus = await projectClient.statuses.findFirst({
      where: { stat_name: 'Active', stat_typeid: 1 },
    });

    if (activeStatus) {
      const activeSprints = await projectClient.sprints.count({
        where: {
          spr_statusid: activeStatus.stat_statusid,
          spr_sprintid: { not: sprintId },
        },
      });

      if (activeSprints > 0) {
        throw new BadRequestException(
          'Another sprint is already active. Complete it before starting a new one.',
        );
      }
    }

    if (!activeStatus) {
      throw new BadRequestException('Active status not found in project');
    }

    // Update sprint status to Active
    const updatedSprint = await projectClient.sprints.update({
      where: { spr_sprintid: sprintId },
      data: {
        spr_statusid: activeStatus.stat_statusid,
        spr_start_date: new Date(),
      },
    });



    return {
      sprint_id: updatedSprint.spr_sprintid,
      name: updatedSprint.spr_name,
      status: {
        status_id: activeStatus.stat_statusid,
        name: 'Active',
      },
      start_date: updatedSprint.spr_start_date,
      end_date: updatedSprint.spr_end_date,
      task_count: sprint.tasks.length,
      message: 'Sprint started successfully',
    };
  }

  async complete(
    projectId: string,
    sprintId: string,
    userId: string,
    dto: CompleteSprintDto,
  ) {
    // Check permissions
    await this.checkUserPermissions(projectId, userId, ['owner', 'admin']);

    const projectClient = await this.getProjectClient(projectId);

    // Get sprint with tasks
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: sprintId },
      include: {
        statuses: { select: { stat_name: true } },
        tasks: {
          include: {
            statuses: {
              include: {
                columns: { select: { col_name: true } },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    // Validate: must be in Active status
    if (sprint.statuses?.stat_name !== 'Active') {
      throw new BadRequestException(
        `Sprint must be in Active status. Current status: ${sprint.statuses?.stat_name}`,
      );
    }

    // Calculate statistics
    const completedTasks = sprint.tasks.filter(
      (t) => t.statuses?.columns?.col_name === 'Done',
    );
    const incompleteTasks = sprint.tasks.filter(
      (t) => t.statuses?.columns?.col_name !== 'Done',
    );

    const completedEstimate = completedTasks.reduce(
      (sum, t) => sum + (t.task_estimate || 0),
      0,
    );
    const incompleteEstimate = incompleteTasks.reduce(
      (sum, t) => sum + (t.task_estimate || 0),
      0,
    );

    // Move incomplete tasks
    if (incompleteTasks.length > 0) {
      if (dto.moveIncompleteTo === MoveIncompleteTo.NEXT_SPRINT) {
        if (!dto.nextSprintId) {
          throw new BadRequestException(
            'nextSprintId required when moving to next sprint',
          );
        }
        await projectClient.tasks.updateMany({
          where: { task_taskid: { in: incompleteTasks.map((t) => t.task_taskid) } },
          data: { task_sprintid: dto.nextSprintId },
        });
      } else {
        // Move to backlog (default)
        await projectClient.tasks.updateMany({
          where: { task_taskid: { in: incompleteTasks.map((t) => t.task_taskid) } },
          data: { task_sprintid: null },
        });
      }
    }

    // Get Completed status
    const completedStatus = await projectClient.statuses.findFirst({
      where: { stat_name: 'Completed', stat_typeid: 1 },
    });

    if (!completedStatus) {
      throw new BadRequestException('Completed status not found in project');
    }

    // Update sprint
    const updatedSprint = await projectClient.sprints.update({
      where: { spr_sprintid: sprintId },
      data: {
        spr_statusid: completedStatus.stat_statusid,
        spr_completed_at: new Date(),
        spr_velocity: completedEstimate,
      },
    });



    return {
      sprint_id: updatedSprint.spr_sprintid,
      name: updatedSprint.spr_name,
      status: {
        status_id: completedStatus.stat_statusid,
        name: 'Completed',
      },
      start_date: updatedSprint.spr_start_date,
      end_date: updatedSprint.spr_end_date,
      completed_at: updatedSprint.spr_completed_at,
      report: {
        total_tasks: sprint.tasks.length,
        completed_tasks: completedTasks.length,
        incomplete_tasks: incompleteTasks.length,
        completion_rate: Math.round(
          (completedTasks.length / sprint.tasks.length) * 100,
        ),
        planned_estimate: completedEstimate + incompleteEstimate,
        completed_estimate: completedEstimate,
        incomplete_estimate: incompleteEstimate,
        velocity: completedEstimate,
      },
      incomplete_tasks_moved_to: dto.moveIncompleteTo || 'backlog',
      message: 'Sprint completed successfully',
    };
  }

  async update(
    projectId: string,
    sprintId: string,
    userId: string,
    dto: UpdateSprintDto,
  ) {
    // Check permissions
    await this.checkUserPermissions(projectId, userId, ['owner', 'admin']);

    const projectClient = await this.getProjectClient(projectId);

    // Get sprint
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: sprintId },
      include: { statuses: { select: { stat_name: true } } },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    // Validate: only Planning sprints can be edited
    if (sprint.statuses?.stat_name !== 'Planning') {
      throw new BadRequestException(
        'Only Planning sprints can be edited. Current status: ' +
          sprint.statuses?.stat_name,
      );
    }

    // Validate dates if provided
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (end <= start) {
        throw new BadRequestException(
          'End date must be later than start date',
        );
      }
    }

    // Update sprint
    const updateData: any = {};
    if (dto.name) updateData.spr_name = dto.name;
    if (dto.goal !== undefined) updateData.spr_goal = dto.goal;
    if (dto.startDate) updateData.spr_start_date = new Date(dto.startDate);
    if (dto.endDate) updateData.spr_end_date = new Date(dto.endDate);

    const updatedSprint = await projectClient.sprints.update({
      where: { spr_sprintid: sprintId },
      data: updateData,
    });

    // Add tasks if provided
    if (dto.addTaskIds && dto.addTaskIds.length > 0) {
      await projectClient.tasks.updateMany({
        where: { task_taskid: { in: dto.addTaskIds } },
        data: { task_sprintid: sprintId },
      });
    }

    // Remove tasks if provided
    if (dto.removeTaskIds && dto.removeTaskIds.length > 0) {
      await projectClient.tasks.updateMany({
        where: { task_taskid: { in: dto.removeTaskIds } },
        data: { task_sprintid: null },
      });
    }



    return {
      sprint_id: updatedSprint.spr_sprintid,
      name: updatedSprint.spr_name,
      goal: updatedSprint.spr_goal,
      start_date: updatedSprint.spr_start_date,
      end_date: updatedSprint.spr_end_date,
      message: 'Sprint updated successfully',
    };
  }

  async remove(projectId: string, sprintId: string, userId: string) {
    // Check permissions
    await this.checkUserPermissions(projectId, userId, ['owner', 'admin']);

    const projectClient = await this.getProjectClient(projectId);

    // Get sprint
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: sprintId },
      include: { statuses: { select: { stat_name: true } } },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    // Validate: only Planning sprints can be deleted
    if (sprint.statuses?.stat_name !== 'Planning') {
      throw new BadRequestException(
        'Only Planning sprints can be deleted. Current status: ' +
          sprint.statuses?.stat_name,
      );
    }

    // Move tasks back to backlog
    await projectClient.tasks.updateMany({
      where: { task_sprintid: sprintId },
      data: { task_sprintid: null },
    });

    // Delete sprint
    await projectClient.sprints.delete({
      where: { spr_sprintid: sprintId },
    });

    return { message: 'Sprint deleted successfully' };
  }

  async getReport(projectId: string, sprintId: string) {
    const projectClient = await this.getProjectClient(projectId);

    // Get sprint with tasks
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: sprintId },
      include: {
        statuses: { select: { stat_name: true } },
        tasks: {
          include: {
            statuses: {
              include: {
                columns: { select: { col_name: true } },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    // Only Active or Completed sprints have reports
    if (
      sprint.statuses?.stat_name !== 'Active' &&
      sprint.statuses?.stat_name !== 'Completed'
    ) {
      throw new BadRequestException(
        'Reports are only available for Active or Completed sprints',
      );
    }

    // Calculate task breakdown
    const taskBreakdown: any = {};
    const columnNames = new Set<string>();
    sprint.tasks.forEach((task) => {
      const colName = task.statuses?.columns?.col_name || 'Unknown';
      columnNames.add(colName);
      if (!taskBreakdown[colName]) {
        taskBreakdown[colName] = { count: 0, estimate: 0 };
      }
      taskBreakdown[colName].count++;
      taskBreakdown[colName].estimate += task.task_estimate || 0;
    });

    const completedTasks = sprint.tasks.filter(
      (t) => t.statuses?.columns?.col_name === 'Done',
    );
    const incompleteTasks = sprint.tasks.filter(
      (t) => t.statuses?.columns?.col_name !== 'Done',
    );

    const totalEstimate = sprint.tasks.reduce(
      (sum, t) => sum + (t.task_estimate || 0),
      0,
    );
    const completedEstimate = completedTasks.reduce(
      (sum, t) => sum + (t.task_estimate || 0),
      0,
    );

    // Calculate burndown data (simplified)
    const burndown = this.calculateBurndown(sprint, totalEstimate, completedEstimate);

    return {
      sprint_id: sprint.spr_sprintid,
      name: sprint.spr_name,
      status: sprint.statuses?.stat_name || 'Unknown',
      start_date: sprint.spr_start_date,
      end_date: sprint.spr_end_date,
      current_date: new Date().toISOString().split('T')[0],
      statistics: {
        total_tasks: sprint.tasks.length,
        completed_tasks: completedTasks.length,
        in_progress_tasks: sprint.tasks.filter(
          (t) => t.statuses?.columns?.col_name === 'In Progress',
        ).length,
        todo_tasks: sprint.tasks.filter(
          (t) => t.statuses?.columns?.col_name === 'To Do',
        ).length,
        completion_rate: Math.round(
          (completedTasks.length / sprint.tasks.length) * 100 * 10,
        ) / 10,
        total_estimate: totalEstimate,
        completed_estimate: completedEstimate,
        remaining_estimate: totalEstimate - completedEstimate,
        velocity: completedEstimate,
      },
      burndown,
      task_breakdown: taskBreakdown,
      completed_tasks: completedTasks.map((t) => ({
        task_id: t.task_taskid,
        title: t.task_title,
        estimate: t.task_estimate,
        completed_at: t.task_updated_at,
      })),
      incomplete_tasks: incompleteTasks.map((t) => ({
        task_id: t.task_taskid,
        title: t.task_title,
        estimate: t.task_estimate,
        status: t.statuses?.stat_name || 'Unknown',
      })),
    };
  }

  private calculateBurndown(sprint: any, totalEstimate: number, completedEstimate: number): Array<{
    date: string;
    ideal_remaining: number;
    actual_remaining: number | null;
  }> {
    if (!sprint.spr_start_date || !sprint.spr_end_date) {
      return [];
    }

    const startDate = new Date(sprint.spr_start_date);
    const endDate = new Date(sprint.spr_end_date);
    const currentDate = new Date();
    
    const sprintDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const idealBurnRate = totalEstimate / sprintDays;

    const burndown: Array<{
      date: string;
      ideal_remaining: number;
      actual_remaining: number | null;
    }> = [];
    
    for (let day = 0; day <= sprintDays; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      
      const dateStr = date.toISOString().split('T')[0];
      const idealRemaining = Math.max(0, Math.round(totalEstimate - idealBurnRate * day));
      
      // Simplified: actual remaining = total - completed (linear)
      const actualRemaining = Math.max(0, totalEstimate - completedEstimate);

      burndown.push({
        date: dateStr,
        ideal_remaining: idealRemaining,
        actual_remaining: date <= currentDate ? actualRemaining : null,
      });
    }

    return burndown;
  }
}

