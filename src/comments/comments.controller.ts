import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@ApiCookieAuth()
@Controller('projects/:projectId/tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new comment on a task',
    description: 'Adds a new comment to a task for team collaboration and discussion. Comments support rich text and are visible to all project members. The comment author is automatically set to the authenticated user.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID to comment on' })
  @ApiResponse({ status: 201, description: 'Comment created successfully with author information' })
  @ApiResponse({ status: 400, description: 'Invalid input - comment content required' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.commentsService.create(projectId, taskId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all comments for a task',
    description: 'Retrieves all comments for a task, ordered by creation date (newest first). Each comment includes author information, timestamp, and edit history. Essential for displaying task discussion threads.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID to fetch comments from' })
  @ApiResponse({ status: 200, description: 'Returns array of comments with author details and timestamps' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findAll(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.commentsService.findAll(projectId, taskId);
  }

  /**
   * GET /api/projects/:projectId/tasks/:taskId/comments/:id
   * Get a single comment by ID
   */
  @Get(':id')
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.commentsService.findOne(projectId, taskId, id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update a comment',
    description: 'Edits the content of an existing comment. Only the original comment author can update their own comments. An "edited" indicator is shown to other users with the last edit timestamp.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiParam({ name: 'id', description: 'Comment UUID to update' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - only comment author can edit' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: any,
  ) {
    return this.commentsService.update(
      projectId,
      taskId,
      id,
      req.user.id,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete a comment',
    description: 'Permanently removes a comment from a task. Can be performed by the comment author or by project administrators/owners. Deletion is irreversible.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiParam({ name: 'id', description: 'Comment UUID to delete' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - only comment author or project admin can delete' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  remove(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.commentsService.remove(projectId, taskId, id, req.user.id);
  }
}
