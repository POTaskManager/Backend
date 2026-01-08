import { Injectable, NotFoundException, Logger, ForbiddenException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { eq, and, or, inArray, sql, isNull } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';
import { InvitationsService } from './invitations.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly invitationsService: InvitationsService,
  ) {}

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

      // Add owner as admin with proper role_id
      const [ownerRole] = await this.getDb()
        .select({ id: globalSchema.roles.id })
        .from(globalSchema.roles)
        .where(eq(globalSchema.roles.name, 'owner'));

      await this.getDb()
        .insert(globalSchema.projectAccess)
        .values({
          projectId: project.id,
          userId: ownerId,
          role: 'owner',
          roleId: ownerRole.id,
          accepted: true,
        });

      // Add initial members if provided
      if (memberIds.length > 0) {
        // Get member role_id
        const [memberRole] = await this.getDb()
          .select({ id: globalSchema.roles.id })
          .from(globalSchema.roles)
          .where(eq(globalSchema.roles.name, 'member'));

        const memberData = memberIds
          .filter(id => id !== ownerId) // Don't duplicate owner
          .map(userId => ({
            projectId: project.id,
            userId,
            role: 'member',
            roleId: memberRole.id,
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

    // Get projects where user has access (member)
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

  async findOne(id: string, userId: string) {
    // Step 1: Check if user has access to this project
    const userAccess = await this.getDb()
      .select({ id: globalSchema.projectAccess.id })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, id),
          eq(globalSchema.projectAccess.userId, userId)
        )
      )
      .limit(1);
    
    if (!userAccess || userAccess.length === 0) {
      throw new ForbiddenException('You are not a member of this project');
    }

    // Step 2: Return project details
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

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    // Step 1: Check if user is owner or admin
    const userAccess = await this.getDb()
      .select({ role: globalSchema.projectAccess.role })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, id),
          eq(globalSchema.projectAccess.userId, userId)
        )
      )
      .limit(1);
    
    if (!userAccess || userAccess.length === 0) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const userRole = userAccess[0].role;
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new ForbiddenException('Only project owner or admin can update the project');
    }

    // Step 2: Update project
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

  async delete(id: string, userId: string) {
    // Step 1: Check if project exists and get namespace
    const project = await this.getDb()
      .select({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
        dbNamespace: globalSchema.projects.dbNamespace,
      })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, id))
      .limit(1);

    if (!project[0]) {
      throw new NotFoundException('Project not found');
    }

    // Step 2: Check user permissions (only owner or admin can delete)
    const userAccess = await this.getDb()
      .select({ role: globalSchema.projectAccess.role })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, id),
          eq(globalSchema.projectAccess.userId, userId),
        ),
      )
      .limit(1);

    if (!userAccess[0]) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const userRole = userAccess[0].role;
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'Only project owner or admin can delete the project',
      );
    }

    // Step 3: Drop project database
    const dbName = `project_${project[0].dbNamespace}`;
    try {
      this.logger.log(`Attempting to drop database: ${dbName}`);
      
      // First, disconnect any active connections to the database
      await this.drizzle.getGlobalDb().execute(sql`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = ${dbName}
          AND pid <> pg_backend_pid()
      `);

      // Now drop the database
      await this.drizzle.getGlobalDb().execute(sql`
        DROP DATABASE IF EXISTS ${sql.identifier(dbName)}
      `);
      
      this.logger.log(`Successfully dropped database: ${dbName}`);
    } catch (error) {
      this.logger.error(`Failed to drop database ${dbName}: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to delete project database: ${error.message}`,
      );
    }

    // Step 4: Delete project record from globaldb (CASCADE will delete projectaccess)
    const result = await this.getDb()
      .delete(globalSchema.projects)
      .where(eq(globalSchema.projects.id, id))
      .returning({
        id: globalSchema.projects.id,
        name: globalSchema.projects.name,
      });

    this.logger.log(
      `Project deleted: ${result[0].name} (${result[0].id}) by user ${userId}`,
    );

    return {
      message: 'Project deleted successfully',
      project: result[0],
    };
  }

  async getMembers(projectId: string, userId: string) {
    // Step 1: Verify user is a member of this project
    const userAccess = await this.getDb()
      .select({ id: globalSchema.projectAccess.id })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, userId)
        )
      )
      .limit(1);
    
    if (!userAccess || userAccess.length === 0) {
      throw new ForbiddenException('You are not a member of this project');
    }

    // Step 2: Return all project members
    const members = await this.getDb()
      .select({
        userId: globalSchema.projectAccess.userId,
        role: globalSchema.projectAccess.role,
        userName: globalSchema.users.name,
        userEmail: globalSchema.users.email,
      })
      .from(globalSchema.projectAccess)
      .leftJoin(
        globalSchema.users,
        eq(globalSchema.projectAccess.userId, globalSchema.users.id),
      )
      .where(eq(globalSchema.projectAccess.projectId, projectId));

    return members;
  }

  async addMember(projectId: string, dto: AddMemberDto, invitedBy: string) {
    // Ensure email is provided
    if (!dto.email) {
      throw new Error('Email must be provided');
    }

    // Resolve roleId from role name if role is provided
    let roleId = dto.roleId;
    const roleName = dto.role || 'member';
    
    if (!roleId) {
      const roleResult = await this.getDb()
        .select({ id: globalSchema.roles.id })
        .from(globalSchema.roles)
        .where(eq(globalSchema.roles.name, roleName));
      
      if (roleResult && roleResult.length > 0) {
        roleId = roleResult[0].id;
      }
    }

    if (!roleId) {
      throw new Error(`Role ${roleName} not found`);
    }

    // Check if user with this email exists
    const [existingUser] = await this.getDb()
      .select({ id: globalSchema.users.id })
      .from(globalSchema.users)
      .where(eq(globalSchema.users.email, dto.email))
      .limit(1);

    // Check if user is already a member (if they exist)
    if (existingUser) {
      const [existingMember] = await this.getDb()
        .select()
        .from(globalSchema.projectAccess)
        .where(
          and(
            eq(globalSchema.projectAccess.projectId, projectId),
            eq(globalSchema.projectAccess.userId, existingUser.id)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new BadRequestException('User is already a member of this project');
      }
    }

    // Always create an invitation (whether user exists or not)
    const invitation = await this.invitationsService.create(
      projectId,
      dto.email,
      roleId,
      invitedBy,
    );

    // TODO: Send invitation email here
    // await this.mailService.sendInvitationEmail(invitation);

    return {
      invitationId: invitation.invitationId,
      email: invitation.email,
      status: invitation.status,
      message: existingUser
        ? 'Invitation sent. User must accept to join the project.'
        : 'Invitation sent. User will need to register and accept the invitation.',
    };
  }

  async removeMember(projectId: string, userIdToRemove: string, requestingUserId: string) {
    // Step 1: Check if requesting user is owner or admin
    const requestingUserAccess = await this.getDb()
      .select({ role: globalSchema.projectAccess.role })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, requestingUserId)
        )
      )
      .limit(1);
    
    if (!requestingUserAccess || requestingUserAccess.length === 0) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const requestingUserRole = requestingUserAccess[0].role;
    if (!requestingUserRole || !['owner', 'admin'].includes(requestingUserRole)) {
      throw new ForbiddenException('Only project owner or admin can remove members');
    }

    // Step 2: Find member to remove
    const existing = await this.getDb()
      .select({ id: globalSchema.projectAccess.id })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, userIdToRemove)
        )
      );
    
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Member not found in project');
    }
    
    // Step 3: Remove member
    const result = await this.getDb()
      .delete(globalSchema.projectAccess)
      .where(eq(globalSchema.projectAccess.id, existing[0].id))
      .returning({ id: globalSchema.projectAccess.id });
    
    return result[0] || null;
  }

  async getActivities(projectId: string, userId: string) {
    // Step 1: Check if project exists
    const project = await this.getDb()
      .select({ id: globalSchema.projects.id, createdBy: globalSchema.projects.createdBy })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId))
      .limit(1);

    if (!project[0]) {
      throw new NotFoundException('Project not found');
    }

    // Step 2: Verify user is the owner
    if (project[0].createdBy !== userId) {
      throw new ForbiddenException('Only project owner can view activity history');
    }

    // Step 3: Get audit logs for this project
    const activities = await this.getDb()
      .select({
        id: globalSchema.projectAccessAudit.id,
        operation: globalSchema.projectAccessAudit.operation,
        changedAt: globalSchema.projectAccessAudit.changedAt,
        changedBy: globalSchema.projectAccessAudit.changedBy,
        userId: globalSchema.projectAccessAudit.userId,
        changedFields: globalSchema.projectAccessAudit.changedFields,
        old: globalSchema.projectAccessAudit.old,
        new: globalSchema.projectAccessAudit.new,
        userName: globalSchema.users.name,
        userEmail: globalSchema.users.email,
      })
      .from(globalSchema.projectAccessAudit)
      .leftJoin(
        globalSchema.users,
        eq(globalSchema.projectAccessAudit.userId, globalSchema.users.id)
      )
      .where(eq(globalSchema.projectAccessAudit.projectId, projectId))
      .orderBy(sql`${globalSchema.projectAccessAudit.changedAt} DESC`);

    return activities;
  }

  async getBacklog(projectId: string, userId: string) {
    // Verify membership
    const isMember = await this.getDb()
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, userId),
          eq(globalSchema.projectAccess.status, 'accepted'),
        )
      );

    if (isMember.length === 0) {
      throw new ForbiddenException('Not a member of this project');
    }

    // Get project namespace
    const project = await this.getDb()
      .select({ namespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (project.length === 0) {
      throw new NotFoundException('Project not found');
    }

    const namespace = project[0].namespace;
    const projectDb = await this.drizzle.getProjectDb(namespace);

    // Get tasks without sprint assignment
    const backlogTasks = await projectDb
      .select()
      .from(projectSchema.tasks)
      .where(isNull(projectSchema.tasks.sprintId))
      .orderBy(projectSchema.tasks.priority, projectSchema.tasks.createdAt);

    return backlogTasks;
  }

  async searchProject(projectId: string, query: string, type?: string, userId?: string) {
    // Verify membership if userId provided
    if (userId) {
      const isMember = await this.getDb()
        .select()
        .from(globalSchema.projectAccess)
        .where(
          and(
            eq(globalSchema.projectAccess.projectId, projectId),
            eq(globalSchema.projectAccess.userId, userId),
            eq(globalSchema.projectAccess.accepted, true),
          )
        );

      if (isMember.length === 0) {
        throw new ForbiddenException('Not a member of this project');
      }
    }

    // Get project namespace
    const project = await this.getDb()
      .select({ namespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (project.length === 0) {
      throw new NotFoundException('Project not found');
    }

    const namespace = project[0].namespace;
    const projectDb = await this.drizzle.getProjectDb(namespace);

    const results: Array<{
      type: string;
      id: string;
      title: string;
      snippet: string;
      createdAt: Date | null;
    }> = [];
    const searchPattern = `%${query}%`;

    // Search tasks
    if (!type || type === 'task') {
      const tasks = await projectDb
        .select()
        .from(projectSchema.tasks)
        .where(
          or(
            sql`${projectSchema.tasks.title} ILIKE ${searchPattern}`,
            sql`${projectSchema.tasks.description} ILIKE ${searchPattern}`
          )
        )
        .limit(50);

      results.push(...tasks.map(task => ({
        type: 'task',
        id: task.id,
        title: task.title,
        snippet: task.description?.substring(0, 200) || '',
        createdAt: task.createdAt,
      })));
    }

    // Search comments
    if (!type || type === 'comment') {
      const comments = await projectDb
        .select()
        .from(projectSchema.comments)
        .where(sql`${projectSchema.comments.content} ILIKE ${searchPattern}`)
        .limit(50);

      results.push(...comments.map(comment => ({
        type: 'comment',
        id: comment.id,
        title: `Comment on task`,
        snippet: comment.content.substring(0, 200),
        createdAt: comment.createdAt,
      })));
    }

    // Search chat messages
    if (!type || type === 'chat') {
      const messages = await projectDb
        .select()
        .from(projectSchema.chatMessages)
        .where(sql`${projectSchema.chatMessages.message} ILIKE ${searchPattern}`)
        .limit(50);

      results.push(...messages.map(msg => ({
        type: 'chat',
        id: msg.id,
        title: `Chat message`,
        snippet: msg.message.substring(0, 200),
        createdAt: msg.createdAt,
      })));
    }

    return {
      results: results.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)),
      total: results.length,
    };
  }

  async updateMemberRole(projectId: string, targetUserId: string, role: string, requestingUserId: string) {
    // Verify requesting user is owner or admin
    const requestingMember = await this.getDb()
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, requestingUserId),
          eq(globalSchema.projectAccess.accepted, true),
        )
      );

    if (requestingMember.length === 0 || !requestingMember[0].role || !['owner', 'admin'].includes(requestingMember[0].role)) {
      throw new ForbiddenException('Only owner or admin can change member roles');
    }

    // Validate role
    if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
      throw new BadRequestException('Invalid role. Must be: owner, admin, member, or viewer');
    }

    // Get target member
    const targetMember = await this.getDb()
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, targetUserId),
          eq(globalSchema.projectAccess.accepted, true),
        )
      );

    if (targetMember.length === 0) {
      throw new NotFoundException('User is not a member of this project');
    }

    // Prevent changing owner role
    if (targetMember[0].role === 'owner') {
      throw new ForbiddenException('Cannot change owner role');
    }

    const oldRole = targetMember[0].role;

    // Update role
    await this.getDb()
      .update(globalSchema.projectAccess)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, targetUserId),
        )
      );

    // Record in audit log
    await this.getDb().insert(globalSchema.projectAccessAudit).values({
      projectId,
      userId: targetUserId,
      operation: 'role_changed',
      changedBy: requestingUserId,
      changedAt: new Date(),
      changedFields: ['role'],
      old: { role: oldRole },
      new: { role },
    });

    // Return updated member
    const updatedMember = await this.getDb()
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, targetUserId),
        )
      );

    return updatedMember[0];
  }

  async getProjectStatistics(projectId: string, userId: string) {
    // Verify membership
    const isMember = await this.getDb()
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, userId),
          eq(globalSchema.projectAccess.accepted, true),
        )
      );

    if (isMember.length === 0) {
      throw new ForbiddenException('Not a member of this project');
    }

    // Get project namespace
    const project = await this.getDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId));

    if (project.length === 0) {
      throw new NotFoundException('Project not found');
    }

    const namespace = project[0].dbNamespace;
    const projectDb = await this.drizzle.getProjectDb(namespace);

    // Get all tasks with status info
    const allTasksWithStatus = await projectDb
      .select({
        task: projectSchema.tasks,
        statusType: projectSchema.statuses.typeId,
      })
      .from(projectSchema.tasks)
      .leftJoin(
        projectSchema.statuses,
        eq(projectSchema.tasks.statusId, projectSchema.statuses.id)
      );
    
    // Get all sprints with status info
    const allSprintsWithStatus = await projectDb
      .select({
        sprint: projectSchema.sprints,
        statusName: projectSchema.statuses.name,
      })
      .from(projectSchema.sprints)
      .leftJoin(
        projectSchema.statuses,
        eq(projectSchema.sprints.statusId, projectSchema.statuses.id)
      );

    // Get all members
    const allMembers = await this.getDb()
      .select()
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.accepted, true),
        )
      );

    // Calculate task statistics
    const taskStats = {
      total: allTasksWithStatus.length,
      completed: allTasksWithStatus.filter(t => t.statusType === 3).length, // 3 = done
      inProgress: allTasksWithStatus.filter(t => t.statusType === 2).length, // 2 = in_progress
      todo: allTasksWithStatus.filter(t => t.statusType === 1).length, // 1 = todo
      backlog: allTasksWithStatus.filter(t => !t.task.sprintId).length,
    };

    // Calculate sprint statistics
    const completedSprints = allSprintsWithStatus.filter(s => s.statusName === 'Completed');
    const totalVelocity = completedSprints.reduce((sum, sprint) => {
      const sprintTasks = allTasksWithStatus.filter(t => t.task.sprintId === sprint.sprint.id);
      const completedInSprint = sprintTasks.filter(t => t.statusType === 3).length;
      return sum + completedInSprint;
    }, 0);

    const sprintStats = {
      total: allSprintsWithStatus.length,
      active: allSprintsWithStatus.filter(s => s.statusName === 'Active').length,
      completed: completedSprints.length,
      averageVelocity: completedSprints.length > 0 ? Math.round(totalVelocity / completedSprints.length) : 0,
    };

    // Calculate team statistics
    const roleCounts = allMembers.reduce((acc, member) => {
      const role = member.role || 'member';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const teamStats = {
      totalMembers: allMembers.length,
      activeMembers: allMembers.length, // Could be refined with activity checks
      roles: roleCounts,
    };

    return {
      tasks: taskStats,
      sprints: sprintStats,
      team: teamStats,
    };
  }
}

