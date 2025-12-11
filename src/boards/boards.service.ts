import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { BoardViewQueryDto, FilterBy, SortBy } from './dto/board-view-query.dto';

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

  async getBoardView(
    projectId: string,
    userId: string,
    queryDto: BoardViewQueryDto,
  ) {
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

    // Get user permissions
    const permissions = await this.getUserPermissions(projectId, userId);

    // Build filter conditions
    const taskFilter: any = {};

    if (queryDto.sprint_id) {
      taskFilter.task_sprintid = queryDto.sprint_id;
    }

    if (queryDto.filter_by === FilterBy.ASSIGNED_TO_ME) {
      taskFilter.task_assigned_to = userId;
    }

    if (queryDto.filter_by === FilterBy.PRIORITY_HIGH) {
      taskFilter.task_priority = { gte: 4 };
    } else if (queryDto.filter_by === FilterBy.PRIORITY_MEDIUM) {
      taskFilter.task_priority = { gte: 2, lte: 3 };
    } else if (queryDto.filter_by === FilterBy.PRIORITY_LOW) {
      taskFilter.task_priority = { lte: 1 };
    }

    if (queryDto.priority_min) {
      taskFilter.task_priority = { gte: queryDto.priority_min };
    }

    // Build sort order
    let taskOrderBy: any = { task_created_at: 'desc' };

    if (queryDto.sort_by === SortBy.DUE_DATE) {
      taskOrderBy = { task_due_at: 'asc' };
    } else if (queryDto.sort_by === SortBy.PRIORITY) {
      taskOrderBy = { task_priority: 'desc' };
    } else if (queryDto.sort_by === SortBy.CREATED_AT) {
      taskOrderBy = { task_created_at: 'desc' };
    }

    // Fetch columns with statuses and tasks
    const columns = await projectClient.columns.findMany({
      orderBy: { col_order: 'asc' },
      select: {
        col_columnid: true,
        col_name: true,
        col_order: true,
        statuses: {
          select: {
            stat_statusid: true,
            stat_name: true,
            tasks: {
              where: taskFilter,
              orderBy: taskOrderBy,
              select: {
                task_taskid: true,
                task_title: true,
                task_description: true,
                task_priority: true,
                task_due_at: true,
                task_created_at: true,
                task_assigned_to: true,
                task_estimate: true,
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
        },
      },
    });

    // Fetch user details from global DB for assigned users
    const userIds = new Set<string>();
    columns.forEach((col) => {
      col.statuses.forEach((status) => {
        status.tasks.forEach((task) => {
          if (task.task_assigned_to) {
            userIds.add(task.task_assigned_to);
          }
        });
      });
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

    // Build response with user data
    const board = columns.map((col) => ({
      column_id: col.col_columnid,
      column_name: col.col_name,
      column_order: col.col_order,
      task_count: col.statuses.reduce((sum, s) => sum + s.tasks.length, 0),
      statuses: col.statuses.map((status) => ({
        status_id: status.stat_statusid,
        status_name: status.stat_name,
        tasks: status.tasks.map((task) => ({
          task_id: task.task_taskid,
          title: task.task_title,
          description: task.task_description,
          priority: task.task_priority,
          due_at: task.task_due_at,
          created_at: task.task_created_at,
          estimate: task.task_estimate,
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
      })),
    }));

    return {
      board,
      filters_applied: {
        sprint_id: queryDto.sprint_id || null,
        filter_by: queryDto.filter_by || null,
        sort_by: queryDto.sort_by || null,
        priority_min: queryDto.priority_min || null,
      },
      permissions,
    };
  }

  async getUserPermissions(projectId: string, userId: string) {
    const access = await this.prisma.projectaccess.findFirst({
      where: {
        pac_projectid: projectId,
        pac_userid: userId,
      },
      select: {
        pac_role: true,
      },
    });

    if (!access) {
      return {
        can_edit: false,
        can_drag: false,
        can_comment: false,
      };
    }

    const role = access.pac_role?.toLowerCase();

    if (role === 'owner' || role === 'admin' || role === 'administrator') {
      return {
        can_edit: true,
        can_drag: true,
        can_comment: true,
      };
    }

    if (role === 'pm' || role === 'project manager') {
      return {
        can_edit: true,
        can_drag: true,
        can_comment: true,
      };
    }

    if (role === 'member' || role === 'developer') {
      return {
        can_edit: true,
        can_drag: true,
        can_comment: true,
      };
    }

    // Stakeholder/Interesariusz - read only
    return {
      can_edit: false,
      can_drag: false,
      can_comment: true,
    };
  }
}
