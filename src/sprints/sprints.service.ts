import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateSprintDto } from './dto/create-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(projectId: string, dto: CreateSprintDto) {
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

    // Create sprint in project database
    return projectClient.sprints.create({
      data: {
        spr_name: dto.name,
        spr_start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        spr_end_date: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      select: {
        spr_sprintid: true,
        spr_name: true,
        spr_start_date: true,
        spr_end_date: true,
        spr_statusid: true,
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

    // Fetch sprints from project database
    return projectClient.sprints.findMany({
      select: {
        spr_sprintid: true,
        spr_name: true,
        spr_start_date: true,
        spr_end_date: true,
        spr_statusid: true,
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

    // Fetch sprint from project database
    const sprint = await projectClient.sprints.findUnique({
      where: { spr_sprintid: id },
      select: {
        spr_sprintid: true,
        spr_name: true,
        spr_start_date: true,
        spr_end_date: true,
        spr_statusid: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException(
        `Sprint ${id} not found in project ${projectId}`,
      );
    }

    return sprint;
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
}
