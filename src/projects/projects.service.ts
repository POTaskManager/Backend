import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { eq, and, or, inArray } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly drizzle: DrizzleService) {}

  private getDb() {
    return this.drizzle.getGlobalDb();
  }

  async create(dto: CreateProjectDto, ownerId: string) {
    // Generate unique namespace from project name
    const baseNamespace = dto.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    let namespace = baseNamespace;
    let counter = 1;
    
    // Ensure namespace is unique
    let existing = await this.getDb()
      .select()
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.dbNamespace, namespace));
    
    while (existing.length > 0) {
      namespace = `${baseNamespace}_${counter}`;
      counter++;
      existing = await this.getDb()
        .select()
        .from(globalSchema.projects)
        .where(eq(globalSchema.projects.dbNamespace, namespace));
    }

    const dbName = `project_${namespace}`;
    
    try {
      // Step 1: Create the project database
      this.logger.log(`Creating project database: ${dbName}`);
      await this.drizzle.createProjectDatabase(namespace);
      
      // Step 2: Resolve member emails to user IDs
      let memberIds: string[] = [];
      if (dto.memberEmails && dto.memberEmails.length > 0) {
        const users = await this.getDb()
          .select({ id: globalSchema.users.id, email: globalSchema.users.email })
          .from(globalSchema.users)
          .where(inArray(globalSchema.users.email, dto.memberEmails));
        
        memberIds = users.map(u => u.id);
        
        // Log if some emails were not found
        const foundEmails = users.map(u => u.email);
        const notFoundEmails = dto.memberEmails.filter(email => !foundEmails.includes(email));
        if (notFoundEmails.length > 0) {
          this.logger.warn(`Some member emails not found: ${notFoundEmails.join(', ')}`);
        }
      }

      // Step 3: Create project record and add members
      const newProject = await this.getDb()
        .insert(globalSchema.projects)
        .values({
          name: dto.name,
          dbNamespace: namespace,
          createdBy: ownerId,
          description: dto.description,
        })
        .returning({
          id: globalSchema.projects.id,
          name: globalSchema.projects.name,
          dbNamespace: globalSchema.projects.dbNamespace,
          createdBy: globalSchema.projects.createdBy,
          createdAt: globalSchema.projects.createdAt,
        });

      const project = newProject[0];

      // Add owner as admin
      await this.getDb()
        .insert(globalSchema.projectAccess)
        .values({
          projectId: project.id,
          userId: ownerId,
          role: 'owner',
          accepted: true,
        });

      // Add initial members if provided
      if (memberIds.length > 0) {
        const memberData = memberIds
          .filter(id => id !== ownerId) // Don't duplicate owner
          .map(userId => ({
            projectId: project.id,
            userId,
            role: 'member',
            accepted: true,
          }));

        if (memberData.length > 0) {
          await this.getDb()
            .insert(globalSchema.projectAccess)
            .values(memberData);
        }
      }

      this.logger.log(`Project ${project.id} created with ${memberIds.length + 1} members`);
      return project;
      
    } catch (error) {
      this.logger.error(`Failed to create project: ${error.message}`);
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  findAll() {
    return this.getDb()
      .select({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
        dbNamespace: globalSchema.projects.dbNamespace,
        createdBy: globalSchema.projects.createdBy,
        createdAt: globalSchema.projects.createdAt,
      })
      .from(globalSchema.projects);
  }

  async findForUser(userId: string) {
    return this.getDb()
      .select({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
        dbNamespace: globalSchema.projects.dbNamespace,
        createdBy: globalSchema.projects.createdBy,
        createdAt: globalSchema.projects.createdAt,
      })
      .from(globalSchema.projects)
      .where(
        or(
          eq(globalSchema.projects.createdBy, userId),
          // Check projectAccess relationship - joined subquery
        )
      );
    
    // Alternative: Direct query without join (simpler)
    // Get projects where user is owner
    const owned = await this.getDb()
      .select({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
        dbNamespace: globalSchema.projects.dbNamespace,
        createdBy: globalSchema.projects.createdBy,
        createdAt: globalSchema.projects.createdAt,
      })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.createdBy, userId));

    // Get projects where user has access
    const access = await this.getDb()
      .select({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
        dbNamespace: globalSchema.projects.dbNamespace,
        createdBy: globalSchema.projects.createdBy,
        createdAt: globalSchema.projects.createdAt,
      })
      .from(globalSchema.projectAccess)
      .innerJoin(globalSchema.projects, eq(globalSchema.projectAccess.projectId, globalSchema.projects.id))
      .where(eq(globalSchema.projectAccess.userId, userId));

    // Merge and deduplicate
    const allProjects = [...owned, ...access];    
    const uniqueProjects = Array.from(
      new Map(allProjects.map(p => [p.id, p])).values()
    );

    return uniqueProjects;
  }

  async findOne(id: string) {
    const result = await this.getDb()
      .select({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
        dbNamespace: globalSchema.projects.dbNamespace,
        createdBy: globalSchema.projects.createdBy,
        createdAt: globalSchema.projects.createdAt,
      })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, id));
    
    return result[0] || null;
  }

  async update(id: string, dto: UpdateProjectDto) {
    const result = await this.getDb()
      .update(globalSchema.projects)
      .set({ name: dto.name })
      .where(eq(globalSchema.projects.id, id))
      .returning({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
        dbNamespace: globalSchema.projects.dbNamespace,
        createdBy: globalSchema.projects.createdBy,
        createdAt: globalSchema.projects.createdAt,
      });
    
    return result[0] || null;
  }

  async delete(id: string) {
    const result = await this.getDb()
      .delete(globalSchema.projects)
      .where(eq(globalSchema.projects.id, id))
      .returning({ id: globalSchema.projects.id });
    
    return result[0] || null;
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    const result = await this.getDb()
      .insert(globalSchema.projectAccess)
      .values({
        projectId,
        userId: dto.userId,
        role: 'member',
      })
      .returning({
        id: globalSchema.projectAccess.id,
        projectId: globalSchema.projectAccess.projectId,
        userId: globalSchema.projectAccess.userId,
        role: globalSchema.projectAccess.role,
      });
    
    return result[0] || null;
  }

  async removeMember(projectId: string, userId: string) {
    const existing = await this.getDb()
      .select({ id: globalSchema.projectAccess.id })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, userId)
        )
      );
    
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Member not found in project');
    }
    
    const result = await this.getDb()
      .delete(globalSchema.projectAccess)
      .where(eq(globalSchema.projectAccess.id, existing[0].id))
      .returning({ id: globalSchema.projectAccess.id });
    
    return result[0] || null;
  }
}
