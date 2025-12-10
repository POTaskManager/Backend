import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Prisma } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';

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
    while (await this.prisma.projects.findFirst({ where: { proj_db_namespace: namespace } })) {
      namespace = `${baseNamespace}_${counter}`;
      counter++;
    }

    const dbName = `project_${namespace}`;
    
    try {
      // Step 1: Create the project database
      this.logger.log(`Creating project database: ${dbName}`);
      await this.prisma.$executeRawUnsafe(`CREATE DATABASE ${dbName}`);
      
      // Step 2: Load schema from projectdb.sql template using docker exec psql
      const sqlPath = path.join(__dirname, '../../../Database/db/projectdb.sql');
      
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
      const newProject = await tx.projects.create({
        data: {
          proj_name: dto.name,
          proj_db_namespace: namespace,
          proj_created_by: dto.ownerId,
          proj_description: dto.description,
        },
        select: {
          proj_projid: true,
          proj_name: true,
          proj_db_namespace: true,
          proj_created_by: true,
          proj_created_at: true,
        },
      });

      // Add owner as admin (assuming role with ID exists or use default)
      await tx.projectaccess.create({
        data: {
          pac_projectid: newProject.proj_projid,
          pac_userid: dto.ownerId,
          pac_role: 'owner',
          pac_accepted: true,
        },
      });

      // Add initial members if provided
      if (dto.memberIds && dto.memberIds.length > 0) {
        const memberData = dto.memberIds
          .filter(id => id !== dto.ownerId) // Don't duplicate owner
          .map(userId => ({
            pac_projectid: newProject.proj_projid,
            pac_userid: userId,
            pac_role: 'member',
            pac_accepted: true,
          }));

        if (memberData.length > 0) {
          await tx.projectaccess.createMany({
            data: memberData,
          });
        }
      }

      return newProject;
    });

    this.logger.log(`Project ${project.proj_projid} created with ${(dto.memberIds?.length || 0) + 1} members`);
    return project;
  }

  findAll() {
    return this.prisma.projects.findMany({
      select: {
        proj_projid: true,
        proj_name: true,
        proj_db_namespace: true,
        proj_created_by: true,
        proj_created_at: true,
      },
    });
  }

  findForUser(userId: string) {
    return this.prisma.projects.findMany({
      where: {
        OR: [
          { proj_created_by: userId },
          {
            projectaccess: {
              some: {
                pac_userid: userId,
              },
            },
          },
        ],
      },
      select: {
        proj_projid: true,
        proj_name: true,
        proj_db_namespace: true,
        proj_created_by: true,
        proj_created_at: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.projects.findUnique({
      where: { proj_projid: id },
      select: {
        proj_projid: true,
        proj_name: true,
        proj_db_namespace: true,
        proj_created_by: true,
        proj_created_at: true,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    return this.prisma.projects.update({
      where: { proj_projid: id },
      data: {
        proj_name: dto.name,
      },
      select: {
        proj_projid: true,
        proj_name: true,
        proj_db_namespace: true,
        proj_created_by: true,
        proj_created_at: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.projects.delete({
      where: { proj_projid: id },
      select: { proj_projid: true },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    return this.prisma.projectaccess.create({
      data: {
        pac_projectid: projectId,
        pac_userid: dto.userId,
        pac_role: 'member',
        pac_role_id: dto.roleId,
      },
      select: {
        pac_accessid: true,
        pac_projectid: true,
        pac_userid: true,
        pac_role: true,
      },
    });
  }

  async removeMember(projectId: string, userId: string) {
    const existing = await this.prisma.projectaccess.findFirst({
      where: {
        pac_projectid: projectId,
        pac_userid: userId,
      },
      select: { pac_accessid: true },
    });
    if (!existing) {
      throw new NotFoundException('Member not found in project');
    }
    return this.prisma.projectaccess.delete({
      where: { pac_accessid: existing.pac_accessid },
      select: { pac_accessid: true },
    });
  }
}
