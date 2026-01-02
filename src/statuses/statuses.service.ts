import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { eq } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';

@Injectable()
export class StatusesService {
  constructor(private readonly drizzle: DrizzleService) {}

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

    // Fetch all statuses with their columns
    const statuses = await projectClient
      .select({
        id: projectSchema.statuses.id,
        name: projectSchema.statuses.name,
        typeId: projectSchema.statuses.typeId,
        columnId: projectSchema.statuses.columnId,
        columnName: projectSchema.columns.name,
        columnOrder: projectSchema.columns.order,
      })
      .from(projectSchema.statuses)
      .leftJoin(
        projectSchema.columns,
        eq(projectSchema.statuses.columnId, projectSchema.columns.id)
      )
      .orderBy(projectSchema.columns.order);

    return statuses;
  }

  async findColumns(projectId: string) {
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

    const columns = await projectClient
      .select()
      .from(projectSchema.columns)
      .orderBy(projectSchema.columns.order);

    return columns;
  }
}
