import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { CreateBoardDto } from './dto/create-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(projectId: string, dto: CreateBoardDto) {
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

    // Get max order to append new column
    const maxOrder = await projectClient.column.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    // Create column in project database
    return projectClient.column.create({
      data: {
        name: dto.name,
        order: (maxOrder?.order ?? -1) + 1,
      },
      select: {
        id: true,
        name: true,
        order: true,
        createdAt: true,
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

    // Fetch columns from project database
    return projectClient.column.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
        createdAt: true,
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

    // Fetch column from project database
    const column = await projectClient.column.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        order: true,
        createdAt: true,
      },
    });

    if (!column) {
      throw new NotFoundException(
        `Board ${id} not found in project ${projectId}`,
      );
    }

    return column;
  }

  async reorderColumns(
    projectId: string,
    columnOrders: Array<{ columnId: string; order: number }>,
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

    // Validate all columns exist
    const columnIds = columnOrders.map((c) => c.columnId);
    const existingColumns = await projectClient.column.findMany({
      where: { id: { in: columnIds } },
    });

    if (existingColumns.length !== columnIds.length) {
      throw new BadRequestException('Some columns do not exist');
    }

    // Update each column's order in a transaction to avoid unique constraint issues
    // First set all to negative values, then set to actual values
    await projectClient.$transaction(async (tx) => {
      // Step 1: Set all orders to negative temporary values
      for (let i = 0; i < columnOrders.length; i++) {
        await tx.column.update({
          where: { id: columnOrders[i].columnId },
          data: { order: -(i + 1) },
        });
      }
      
      // Step 2: Set to actual target values
      for (const col of columnOrders) {
        await tx.column.update({
          where: { id: col.columnId },
          data: { order: col.order },
        });
      }
    });

    // Return updated columns
    return projectClient.column.findMany({
      where: { id: { in: columnIds } },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
      },
    });
  }

  async getWorkflow(projectId: string) {
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

    // Get all statuses with their transitions
    const statuses = await projectClient.status.findMany({
      where: { typeId: 2 }, // 2 = Task Status
      include: {
        column: true,
        transitionsFrom: {
          include: {
            toRef: {
              include: {
                column: true,
              },
            },
          },
        },
      },
      orderBy: {
        column: {
          order: 'asc',
        },
      },
    });

    // Build workflow graph
    const nodes = statuses.map((status) => ({
      status_id: status.id,
      status_name: status.name,
      column_id: status.columnId,
      column_name: status.column?.name || null,
      column_order: status.column?.order || null,
    }));

    const edges = statuses.flatMap((status) =>
      status.transitionsFrom
        .filter((transition) => transition.toRef !== null)
        .map((transition) => ({
          from_status_id: status.id,
          from_status_name: status.name,
          to_status_id: transition.toRef!.id,
          to_status_name: transition.toRef!.name,
          transition_id: transition.id,
        })),
    );

    return {
      nodes,
      edges,
    };
  }
}
