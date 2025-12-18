import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDatabaseService } from '../project-database/project-database.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDatabaseService,
  ) {}

  async create(dto: CreateProjectDto, ownerId: string) {
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
      
      // Step 2: Create temporary connection to new database (NOT via ProjectDatabaseService)
      // ProjectDatabaseService caches connections, but we need fresh connection for schema init
      const dbHost = process.env.DB_HOST || 'db';
      const dbPort = process.env.DB_PORT || '5432';
      const dbUser = process.env.DB_USER || 'postgres';
      const dbPassword = process.env.DB_PASSWORD || 'changeme';
      const dbUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?schema=public`;
      
      const { PrismaClient: ProjectPrismaClient } = await import('@prisma-project/client');
      const tempClient = new ProjectPrismaClient({
        datasources: { db: { url: dbUrl } }
      });
      
      await tempClient.$connect();
      this.logger.log(`Connected to new project database: ${dbName}`);
      
      // Step 3: Load schema from projectdb.sql
      const schemaPath = join(__dirname, '../../prisma/projectdb.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');
      
      // Remove comments and split SQL into individual statements
      const statements = schemaSql
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        })
        .join('\n')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      this.logger.log(`Executing ${statements.length} schema statements`);
      
      // Execute schema statements
      for (let i = 0; i < statements.length; i++) {
        try {
          await tempClient.$executeRawUnsafe(statements[i]);
        } catch (err) {
          this.logger.error(`Failed to execute statement ${i+1}/${statements.length}: ${err.message}`);
          this.logger.debug(`Statement: ${statements[i].substring(0, 100)}...`);
          throw err;
        }
      }
      
      // Reconnect to refresh schema metadata cache
      await tempClient.$disconnect();
      await tempClient.$connect();
      this.logger.log(`Schema loaded, reconnected to refresh metadata`);
      
      // Step 4: Load seed data from seed-project-data.sql
      this.logger.log(`Seeding basic data for ${dbName}`);
      const seedPath = join(__dirname, '../../prisma/seed-project-data.sql');
      const seedSql = readFileSync(seedPath, 'utf8');
      
      const seedStatements = seedSql
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        })
        .join('\n')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      this.logger.log(`Executing ${seedStatements.length} seed statements`);
      
      for (const statement of seedStatements) {
        await tempClient.$executeRawUnsafe(statement);
      }
      
      await tempClient.$disconnect();
      
      this.logger.log(`Project database ${dbName} created successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to create project database: ${error.message}`);
      throw new Error(`Failed to create project database: ${error.message}`);
    }

    // Step 3: Resolve member emails to user IDs
    let memberIds: string[] = [];
    if (dto.memberEmails && dto.memberEmails.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          email: {
            in: dto.memberEmails,
          },
        },
        select: {
          id: true,
          email: true,
        },
      });
      
      memberIds = users.map(u => u.id);
      
      // Log if some emails were not found
      const foundEmails = users.map(u => u.email);
      const notFoundEmails = dto.memberEmails.filter(email => !foundEmails.includes(email));
      if (notFoundEmails.length > 0) {
        this.logger.warn(`Some member emails not found: ${notFoundEmails.join(', ')}`);
      }
    }

    // Step 4: Create project record and add members in transaction
    const project = await this.prisma.$transaction(async (tx) => {
      // Create project
      const newProject = await tx.project.create({
        data: {
          name: dto.name,
          dbNamespace: namespace,
          createdBy: ownerId,
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
          userId: ownerId,
          role: 'owner',
          accepted: true,
        },
      });

      // Add initial members if provided
      if (memberIds.length > 0) {
        const memberData = memberIds
          .filter(id => id !== ownerId) // Don't duplicate owner
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

    this.logger.log(`Project ${project.id} created with ${memberIds.length + 1} members`);
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
