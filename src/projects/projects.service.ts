import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Prisma } from '@prisma/client';
import { execSync } from 'child_process';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    // Generate unique namespace from project name
    const baseNamespace = dto.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    let namespace = baseNamespace;
    let counter = 1;
    
    // Ensure namespace is unique
    while (await this.prisma.project.findFirst({ where: { dbNamespace: namespace } })) {
      namespace = `${baseNamespace}_${counter}`;
      counter++;
    }

    const dbName = `project_${namespace}`;
    
    try {
      // Step 1: Create the project database
      this.logger.log(`Creating project database: ${dbName}`);
      await this.prisma.$executeRawUnsafe(`CREATE DATABASE ${dbName}`);
      
      // Step 2: Load schema from projectdb.sql template using docker exec psql
      // Use docker exec to run psql inside the database container
      // This avoids needing psql installed on the host
      execSync(
        `docker exec potask_db psql -U postgres -d ${dbName} -f /docker-entrypoint-initdb.d/projectdb.sql -q`,
        { stdio: 'pipe' }
      );
      
      this.logger.log(`Project database ${dbName} created successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to create project database: ${error.message}`);
      throw new Error(`Failed to create project database: ${error.message}`);
    }

    // Step 4: Create project record and add members in transaction
    const project = await this.prisma.$transaction(async (tx) => {
      // Create project
      const newProject = await tx.project.create({
        data: {
          name: dto.name,
          dbNamespace: namespace,
          createdBy: dto.ownerId,
          description: dto.description,
        },
        select: {
          id: true,
          name: true,
          dbNamespace: true,
          createdBy: true,
          createdAt: true,
        },
      });

      // Add owner as admin (assuming role with ID exists or use default)
      await tx.projectAccess.create({
        data: {
          projectId: newProject.id,
          userId: dto.ownerId,
          role: 'owner',
          accepted: true,
        },
      });

      // Add initial members if provided
      if (dto.memberIds && dto.memberIds.length > 0) {
        const memberData = dto.memberIds
          .filter(id => id !== dto.ownerId) // Don't duplicate owner
          .map(userId => ({
            projectId: newProject.id,
            userId,
            role: 'member',
            accepted: true,
          }));

        if (memberData.length > 0) {
          await tx.projectAccess.createMany({
            data: memberData,
          });
        }
      }

      return newProject;
    });

    this.logger.log(`Project ${project.id} created with ${(dto.memberIds?.length || 0) + 1} members`);
    return project;
  }

  findAll() {
    return this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        dbNamespace: true,
        createdBy: true,
        createdAt: true,
      },
    });
  }

  findForUser(userId: string) {
    return this.prisma.project.findMany({
      where: {
        OR: [
          { createdBy: userId },
          {
            projectAccess: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        dbNamespace: true,
        createdBy: true,
        createdAt: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        dbNamespace: true,
        createdBy: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
      },
      select: {
        id: true,
        name: true,
        dbNamespace: true,
        createdBy: true,
        createdAt: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.project.delete({
      where: { id },
      select: { id: true },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    return this.prisma.projectAccess.create({
      data: {
        projectId,
        userId: dto.userId,
        role: 'member',
        roleId: dto.roleId,
      },
      select: {
        accessId: true,
        projectId: true,
        userId: true,
        role: true,
      },
    });
  }

  async removeMember(projectId: string, userId: string) {
    const existing = await this.prisma.projectAccess.findFirst({
      where: {
        projectId,
        userId,
      },
      select: { accessId: true },
    });
    if (!existing) {
      throw new NotFoundException('Member not found in project');
    }
    return this.prisma.projectAccess.delete({
      where: { accessId: existing.accessId },
      select: { accessId: true },
    });
  }
}
