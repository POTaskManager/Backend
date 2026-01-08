import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/dto/user.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationResendDto } from './dto/invitation-resend.dto';
import { InvitationsService } from './invitations.service';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiCookieAuth()
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new project',
    description: 'Creates a new project with dedicated isolated database (multi-tenant architecture). The project creator automatically becomes the owner with full administrative privileges. Each project has a unique namespace and gets its own PostgreSQL database (project_<namespace>) with complete task management schema (tasks, sprints, boards, chat, etc.).'
  })
  @ApiResponse({ status: 201, description: 'Project created successfully with dedicated database' })
  @ApiResponse({ status: 400, description: 'Invalid input or namespace already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    return this.projectsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all projects for current user',
    description: 'Retrieves all projects where the current user is a member (any role: owner, admin, member, or viewer). Returns project metadata including name, description, member count, and user\'s role. Projects are filtered by membership - users only see projects they belong to for data isolation.'
  })
  @ApiResponse({ status: 200, description: 'Returns list of projects the user is a member of' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: User) {
    // Always filter projects by current user - show only projects they belong to
    return this.projectsService.findForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get project by ID',
    description: 'Retrieves detailed information about a specific project including name, description, namespace, creation date, and metadata. Requires membership verification - only project members can view project details. Essential for loading project-specific views and settings.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns project details' })
  @ApiResponse({ status: 403, description: 'Access denied - not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.findOne(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update project',
    description: 'Updates project metadata such as name, description, or settings. Requires owner or admin role - regular members and viewers cannot modify project settings. Changes are immediately visible to all project members and recorded in the activity audit log.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 403, description: 'Only owner/admin can update project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete project and its database',
    description: 'Permanently deletes a project and its dedicated database. This is irreversible and destroys all project data including tasks, sprints, boards, chat history, and files. Only the project owner can perform this operation. All members lose access immediately.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only owner can delete project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.delete(id, user.id);
  }

  @Get(':id/members')
  @ApiTags('projects', 'invitations')
  @ApiOperation({ 
    summary: 'Get project members',
    description: 'Retrieves all members of a project with their roles (owner, admin, member, viewer) and user information. Requires project membership - only current members can view the member list. Essential for displaying team rosters, permission management, and @mention autocomplete.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of project members with roles' })
  @ApiResponse({ status: 403, description: 'Access denied - not a project member' })
  getMembers(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.getMembers(projectId, user.id);
  }

  @Post(':id/members')
  @ApiTags('projects', 'invitations')
  @ApiOperation({ 
    summary: 'Invite user to project (creates invitation)',
    description: 'Sends an email invitation to a user to join the project. The invitation includes a unique token valid for 7 days. Only project owners and admins can send invitations. The invited user must accept the invitation to become a project member. If the user is already a member, returns an error.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  @ApiResponse({ status: 400, description: 'User already a member' })
  @ApiResponse({ status: 403, description: 'Only owner/admin can invite members' })
  addMember(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.addMember(projectId, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiTags('projects', 'invitations')
  @ApiOperation({ 
    summary: 'Remove member from project',
    description: 'Removes a user from the project, revoking all access to project resources (tasks, boards, chat, etc.). Only project owners and admins can remove members. The project owner cannot be removed. Removed users no longer see the project in their project list and cannot access any project data.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID to remove' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Only owner/admin can remove members' })
  removeMember(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.removeMember(projectId, userId, user.id);
  }

  @Get(':id/activities')
  @ApiTags('projects')
  @ApiOperation({ 
    summary: 'Get project activity history',
    description: 'Returns audit log of project activities including member changes, role updates, and project modifications. Only accessible by project owner.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of project activities',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          operation: { type: 'string', enum: ['INSERT', 'UPDATE', 'DELETE'] },
          changedAt: { type: 'string', format: 'date-time' },
          changedBy: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          userName: { type: 'string' },
          userEmail: { type: 'string' },
          changedFields: { type: 'object' },
          old: { type: 'object' },
          new: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only project owner can view activities' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getActivities(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.getActivities(projectId, user.id);
  }

  @Get(':id/invitations')
  @ApiTags('invitations')
  @ApiOperation({ 
    summary: 'List pending invitations for project',
    description: 'Retrieves all pending (not yet accepted) invitations for the project. Shows invited user emails, invitation dates, expiry status, and who sent the invitation. Useful for managing outstanding invitations and tracking who has been invited but not yet joined.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of pending invitations' })
  listInvitations(@Param('id', new ParseUUIDPipe()) projectId: string) {
    return this.invitationsService.listPending(projectId);
  }

  @Post(':id/invitations/:email/resend')
  @ApiTags('invitations')
  @ApiOperation({ 
    summary: 'Resend invitation email',
    description: 'Resends the invitation email to a user with a new invitation token. Useful when the original email was lost, spam-filtered, or the token expired. The old token is invalidated and a new 7-day token is generated. Email contains project details and accept invitation link.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'email', description: 'User email' })
  @ApiResponse({ status: 200, description: 'Invitation resent with new token' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  resendInvitation(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Param('email') email: string,
  ) {
    return this.invitationsService.resend(projectId, email);
  }

  @Delete(':id/invitations/:email')
  @ApiTags('invitations')
  @ApiOperation({ 
    summary: 'Cancel pending invitation',
    description: 'Cancels a pending invitation before it is accepted. The invitation token becomes invalid and the user can no longer use it to join the project. Use this to retract invitations sent by mistake or to users who should no longer join.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'email', description: 'User email' })
  @ApiResponse({ status: 200, description: 'Invitation cancelled' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  cancelInvitation(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Param('email') email: string,
  ) {
    return this.invitationsService.cancel(projectId, email);
  }

  @Post('invitations/accept/:token')
  @ApiTags('invitations')
  @ApiOperation({ 
    summary: 'Accept project invitation',
    description: 'Accepts a project invitation using the token from the invitation email. The current authenticated user is added as a member to the project with the role specified in the invitation (typically "member"). The token is single-use and expires after 7 days. After acceptance, the user gains immediate access to all project resources.'
  })
  @ApiParam({ name: 'token', description: 'Invitation token from email' })
  @ApiResponse({ status: 200, description: 'Invitation accepted, user added to project' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: User,
  ) {
    const invitation = await this.invitationsService.accept(token, user.id);
    return { 
      status: 'accepted', 
      invitation,
      message: 'Successfully joined the project',
    };
  }

  @Get('invitations/my')
  @ApiTags('invitations')
  @ApiOperation({ 
    summary: 'Get my pending invitations (for dashboard)',
    description: 'Retrieves all pending project invitations for the current user\'s email address. Shows project details, who invited them, invitation date, and expiry status. Essential for displaying invitation notifications in the user dashboard and allowing quick acceptance of pending invitations. Invitations appear here until accepted, cancelled, or expired.'
  })
  @ApiResponse({ status: 200, description: 'Returns pending invitations for current user with project and inviter details' })
  async getMyInvitations(@CurrentUser() user: User) {
    return this.invitationsService.listForUser(user.email);
  }

  @Get(':id/backlog')
  @ApiOperation({ 
    summary: 'Get project backlog',
    description: 'Retrieves all tasks that are not assigned to any sprint (backlog items). These are tasks planned for future sprints or awaiting prioritization. Includes task details, priorities, and labels. Essential for sprint planning and backlog grooming sessions.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of backlog tasks (tasks without sprint assignment)' })
  @ApiResponse({ status: 403, description: 'Access denied - not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getBacklog(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.getBacklog(projectId, user.id);
  }

  @Get(':id/search')
  @ApiOperation({ 
    summary: 'Search within project',
    description: 'Searches across all project content including tasks, comments, and chat messages. Supports full-text search with filters by content type, date ranges, and authors. Returns results with context snippets and relevance scoring. Essential for finding information quickly in large projects.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns search results with snippets and metadata',
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['task', 'comment', 'chat'] },
              id: { type: 'string' },
              title: { type: 'string' },
              snippet: { type: 'string' },
              relevance: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied - not a project member' })
  async searchProject(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Query('q') query: string,
    @Query('type') type?: string,
    @CurrentUser() user?: User,
  ) {
    return this.projectsService.searchProject(projectId, query, type, user?.id);
  }

  @Put(':id/members/:userId/role')
  @ApiOperation({ 
    summary: 'Update member role',
    description: 'Changes the role of a project member (owner, admin, member, viewer). Only project owners and admins can change roles. The project owner role cannot be changed or removed. Role changes affect permissions immediately and are recorded in the audit log.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID whose role to update' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid role or cannot change owner role' })
  @ApiResponse({ status: 403, description: 'Only owner/admin can change roles' })
  @ApiResponse({ status: 404, description: 'Project or member not found' })
  async updateMemberRole(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body('role') role: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.updateMemberRole(projectId, userId, role, user.id);
  }

  @Get(':id/statistics')
  @ApiOperation({ 
    summary: 'Get project statistics',
    description: 'Retrieves comprehensive project metrics including total tasks, completion rates, active sprints, team velocity, burndown data, and member activity. Essential for project dashboards, reports, and progress tracking. Updated in real-time as project data changes.'
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns detailed project statistics and metrics',
    schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            completed: { type: 'number' },
            inProgress: { type: 'number' },
            todo: { type: 'number' },
            backlog: { type: 'number' },
          },
        },
        sprints: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
            completed: { type: 'number' },
            averageVelocity: { type: 'number' },
          },
        },
        team: {
          type: 'object',
          properties: {
            totalMembers: { type: 'number' },
            activeMembers: { type: 'number' },
            roles: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied - not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectStatistics(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.getProjectStatistics(projectId, user.id);
  }
}
