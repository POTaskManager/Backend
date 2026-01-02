import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { eq, and } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';

@Injectable()
export class LabelsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(projectId: string, dto: CreateLabelDto) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    const result = await projectClient
      .insert(projectSchema.labels)
      .values({
        name: dto.name,
        color: dto.color || '#808080',
      })
      .returning({
        id: projectSchema.labels.id,
        name: projectSchema.labels.name,
        color: projectSchema.labels.color,
        createdAt: projectSchema.labels.createdAt,
      });

    return result[0];
  }

  async findAll(projectId: string) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    return await projectClient
      .select({
        id: projectSchema.labels.id,
        name: projectSchema.labels.name,
        color: projectSchema.labels.color,
        createdAt: projectSchema.labels.createdAt,
      })
      .from(projectSchema.labels);
  }

  async findOne(projectId: string, id: string) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    const result = await projectClient
      .select({
        id: projectSchema.labels.id,
        name: projectSchema.labels.name,
        color: projectSchema.labels.color,
        createdAt: projectSchema.labels.createdAt,
      })
      .from(projectSchema.labels)
      .where(eq(projectSchema.labels.id, id));

    if (!result || result.length === 0) {
      throw new NotFoundException(`Label ${id} not found`);
    }

    return result[0];
  }

  async update(projectId: string, id: string, dto: UpdateLabelDto) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    const result = await projectClient
      .update(projectSchema.labels)
      .set(dto)
      .where(eq(projectSchema.labels.id, id))
      .returning({
        id: projectSchema.labels.id,
        name: projectSchema.labels.name,
        color: projectSchema.labels.color,
        createdAt: projectSchema.labels.createdAt,
      });

    if (!result || result.length === 0) {
      throw new NotFoundException(`Label ${id} not found`);
    }

    return result[0];
  }

  async remove(projectId: string, id: string) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    const result = await projectClient
      .delete(projectSchema.labels)
      .where(eq(projectSchema.labels.id, id))
      .returning({ id: projectSchema.labels.id });

    if (!result || result.length === 0) {
      throw new NotFoundException(`Label ${id} not found`);
    }

    return { message: 'Label deleted successfully', id: result[0].id };
  }

  async assignToTask(projectId: string, taskId: string, labelId: string) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    // Check if already assigned
    const existing = await projectClient
      .select()
      .from(projectSchema.taskLabels)
      .where(
        and(
          eq(projectSchema.taskLabels.taskId, taskId),
          eq(projectSchema.taskLabels.labelId, labelId),
        ),
      );

    if (existing && existing.length > 0) {
      return { message: 'Label already assigned to task' };
    }

    const result = await projectClient
      .insert(projectSchema.taskLabels)
      .values({
        taskId,
        labelId,
      })
      .returning({
        id: projectSchema.taskLabels.id,
        taskId: projectSchema.taskLabels.taskId,
        labelId: projectSchema.taskLabels.labelId,
      });

    return result[0];
  }

  async removeFromTask(projectId: string, taskId: string, labelId: string) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    const result = await projectClient
      .delete(projectSchema.taskLabels)
      .where(
        and(
          eq(projectSchema.taskLabels.taskId, taskId),
          eq(projectSchema.taskLabels.labelId, labelId),
        ),
      )
      .returning({ id: projectSchema.taskLabels.id });

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `Label assignment not found for task ${taskId} and label ${labelId}`,
      );
    }

    return { message: 'Label removed from task successfully' };
  }

  async getTaskLabels(projectId: string, taskId: string) {
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

    const projectClient = await this.drizzle.getProjectDb(
      project[0].dbNamespace,
    );

    return await projectClient
      .select({
        id: projectSchema.labels.id,
        name: projectSchema.labels.name,
        color: projectSchema.labels.color,
      })
      .from(projectSchema.taskLabels)
      .leftJoin(
        projectSchema.labels,
        eq(projectSchema.taskLabels.labelId, projectSchema.labels.id),
      )
      .where(eq(projectSchema.taskLabels.taskId, taskId));
  }
}
