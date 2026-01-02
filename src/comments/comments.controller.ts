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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('projects/:projectId/tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * POST /api/projects/:projectId/tasks/:taskId/comments
   * Create a new comment on a task
   */
  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.commentsService.create(projectId, taskId, req.user.id, dto);
  }

  /**
   * GET /api/projects/:projectId/tasks/:taskId/comments
   * Get all comments for a task (ordered by newest first)
   */
  @Get()
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

  /**
   * PUT /api/projects/:projectId/tasks/:taskId/comments/:id
   * Update a comment (only by the author)
   */
  @Put(':id')
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

  /**
   * DELETE /api/projects/:projectId/tasks/:taskId/comments/:id
   * Delete a comment (by author or project admin/owner)
   */
  @Delete(':id')
  remove(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.commentsService.remove(projectId, taskId, id, req.user.id);
  }
}
