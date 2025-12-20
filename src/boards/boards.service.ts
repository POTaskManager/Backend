import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { eq, inArray, desc, and } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';

@Injectable()
export class BoardsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(projectId: string, dto: CreateBoardDto) {
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

    // Get max order to append new column
    const maxOrder = await projectClient
      .select({ order: projectSchema.columns.order })
      .from(projectSchema.columns)
      .orderBy(desc(projectSchema.columns.order))
      .limit(1);

    // Create column in project database
    const result = await projectClient
      .insert(projectSchema.columns)
      .values({
        name: dto.name,
        order: (maxOrder[0]?.order ?? -1) + 1,
      })
      .returning({
        id: projectSchema.columns.id,
        name: projectSchema.columns.name,
        order: projectSchema.columns.order,
        createdAt: projectSchema.columns.createdAt,
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

    // Fetch columns from project database
    return projectClient
      .select({
        id: projectSchema.columns.id,
        name: projectSchema.columns.name,
        order: projectSchema.columns.order,
        createdAt: projectSchema.columns.createdAt,
      })
      .from(projectSchema.columns)
      .orderBy(projectSchema.columns.order);
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

    // Fetch column from project database
    const column = await projectClient
      .select({
        id: projectSchema.columns.id,
        name: projectSchema.columns.name,
        order: projectSchema.columns.order,
        createdAt: projectSchema.columns.createdAt,
      })
      .from(projectSchema.columns)
      .where(eq(projectSchema.columns.id, id));

    if (!column || column.length === 0) {
      throw new NotFoundException(
        `Board ${id} not found in project ${projectId}`,
      );
    }

    return column[0];
  }

  async reorderColumns(
    projectId: string,
    columnOrders: Array<{ columnId: string; order: number }>,
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

    // Validate all columns exist
    const columnIds = columnOrders.map((c) => c.columnId);
    const existingColumns = await projectClient
      .select({ id: projectSchema.columns.id })
      .from(projectSchema.columns)
      .where(inArray(projectSchema.columns.id, columnIds));

    if (existingColumns.length !== columnIds.length) {
      throw new BadRequestException('Some columns do not exist');
    }

    // Update each column's order
    // First set all to negative values, then set to actual values (to avoid unique constraint)
    for (let i = 0; i < columnOrders.length; i++) {
      await projectClient
        .update(projectSchema.columns)
        .set({ order: -(i + 1) })
        .where(eq(projectSchema.columns.id, columnOrders[i].columnId));
    }

    // Set to actual target values
    for (const col of columnOrders) {
      await projectClient
        .update(projectSchema.columns)
        .set({ order: col.order })
        .where(eq(projectSchema.columns.id, col.columnId));
    }

    // Return updated columns
    return projectClient
      .select({
        id: projectSchema.columns.id,
        name: projectSchema.columns.name,
        order: projectSchema.columns.order,
      })
      .from(projectSchema.columns)
      .where(inArray(projectSchema.columns.id, columnIds))
      .orderBy(projectSchema.columns.order);
  }

  async getWorkflow(projectId: string) {
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

    // Get all statuses with their columns
    const statuses = await projectClient
      .select()
      .from(projectSchema.statuses)
      .where(eq(projectSchema.statuses.typeId, 2)) // 2 = Task Status
      .leftJoin(projectSchema.columns, eq(projectSchema.statuses.columnId, projectSchema.columns.id));

    // Get all transitions
    const transitions = await projectClient
      .select()
      .from(projectSchema.statusTransitions);

    // Build workflow graph
    const nodes = statuses.map((row) => ({
      status_id: row.statuses.id,
      status_name: row.statuses.name,
      column_id: row.columns?.id || null,
      column_name: row.columns?.name || null,
      column_order: row.columns?.order || null,
    }));

    const edges = transitions
      .filter((t) => t.toStatusId !== null)
      .map((transition) => {
        const fromStatus = statuses.find((s) => s.statuses.id === transition.fromStatusId);
        const toStatus = statuses.find((s) => s.statuses.id === transition.toStatusId);
        
        return {
          from_status_id: transition.fromStatusId,
          from_status_name: fromStatus?.statuses.name || null,
          to_status_id: transition.toStatusId,
          to_status_name: toStatus?.statuses.name || null,
          transition_id: transition.id,
        };
      });

    return {
      nodes,
      edges,
    };
  }
}
