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
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationResendDto } from './dto/invitation-resend.dto';
import { InvitationsService } from './invitations.service';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  findAll(@Query('userId') userId?: string) {
    if (userId) {
      return this.projectsService.findForUser(userId);
    }
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.projectsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.projectsService.delete(id);
  }

  @Post(':id/members')
  addMember(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectsService.addMember(projectId, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.projectsService.removeMember(projectId, userId);
  }

  @Get(':id/invitations')
  listInvitations(@Param('id', new ParseUUIDPipe()) projectId: string) {
    return this.invitationsService.listPending(projectId);
  }

  @Post(':id/invitations/resend')
  resendInvitation(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Body() dto: InvitationResendDto,
  ) {
    return this.invitationsService.resendInvitation(
      projectId,
      dto.email,
      dto.roleId,
      dto.invitedBy,
    );
  }

  @Post(':id/invitations/accept')
  async acceptInvitation(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    const invitation = this.invitationsService.accept(dto.token);
    if (!invitation || invitation.projectId !== projectId) {
      throw new BadRequestException('Invalid or expired invitation token');
    }
    if (!invitation.roleId) {
      throw new BadRequestException(
        'Invitation missing roleId; cannot add member',
      );
    }

    const membership = await this.projectsService.addMember(projectId, {
      userId: dto.userId,
      roleId: invitation.roleId,
    });

    return { status: 'accepted', membership, invitation };
  }
}
