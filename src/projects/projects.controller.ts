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
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully with dedicated database' })
  @ApiResponse({ status: 400, description: 'Invalid input or namespace already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    return this.projectsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects for current user' })
  @ApiResponse({ status: 200, description: 'Returns list of projects the user is a member of' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: User) {
    // Always filter projects by current user - show only projects they belong to
    return this.projectsService.findForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns project details' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.projectsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project and its database' })
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
  @ApiOperation({ summary: 'Get project members' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of project members with roles' })
  getMembers(@Param('id', new ParseUUIDPipe()) projectId: string) {
    return this.projectsService.getMembers(projectId);
  }

  @Post(':id/members')
  @ApiTags('projects', 'invitations')
  @ApiOperation({ summary: 'Invite user to project (creates invitation)' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  @ApiResponse({ status: 400, description: 'User already a member' })
  addMember(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.addMember(projectId, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiTags('projects', 'invitations')
  @ApiOperation({ summary: 'Remove member from project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID to remove' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  removeMember(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.projectsService.removeMember(projectId, userId);
  }

  @Get(':id/invitations')
  @ApiTags('invitations')
  @ApiOperation({ summary: 'List pending invitations for project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of pending invitations' })
  listInvitations(@Param('id', new ParseUUIDPipe()) projectId: string) {
    return this.invitationsService.listPending(projectId);
  }

  @Post(':id/invitations/:email/resend')
  @ApiTags('invitations')
  @ApiOperation({ summary: 'Resend invitation email' })
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
  @ApiOperation({ summary: 'Cancel pending invitation' })
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
  @ApiOperation({ summary: 'Accept project invitation' })
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
  @ApiOperation({ summary: 'Get my pending invitations (for dashboard)' })
  @ApiResponse({ status: 200, description: 'Returns pending invitations for current user with project and inviter details' })
  async getMyInvitations(@CurrentUser() user: User) {
    return this.invitationsService.listForUser(user.email);
  }
}
