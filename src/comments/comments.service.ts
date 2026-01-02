import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { eq, and, desc } from 'drizzle-orm';
import * as globalSchema from '../drizzle/schemas/global.schema';
import * as projectSchema from '../drizzle/schemas/project.schema';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Create a new comment on a task
   */
  async create(
    projectId: string,
    taskId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    // Get project namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId))
      .limit(1);

    if (!project[0]) {
      throw new NotFoundException('Project not found');
    }

    const projectDb = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Verify task exists
    const task = await projectDb
      .select({ id: projectSchema.tasks.id })
      .from(projectSchema.tasks)
      .where(eq(projectSchema.tasks.id, taskId))
      .limit(1);

    if (!task[0]) {
      throw new NotFoundException('Task not found');
    }

    // Create comment
    const result = await projectDb
      .insert(projectSchema.comments)
      .values({
        taskId,
        userId,
        content: dto.content,
      })
      .returning({
        id: projectSchema.comments.id,
        taskId: projectSchema.comments.taskId,
        userId: projectSchema.comments.userId,
        content: projectSchema.comments.content,
        createdAt: projectSchema.comments.createdAt,
        editedAt: projectSchema.comments.editedAt,
      });

    this.logger.log(`Comment created by user ${userId} on task ${taskId}`);
    return result[0];
  }

  /**
   * Get all comments for a task
   */
  async findAll(projectId: string, taskId: string) {
    // Get project namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId))
      .limit(1);

    if (!project[0]) {
      throw new NotFoundException('Project not found');
    }

    const projectDb = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Get comments ordered by creation date (newest first)
    const comments = await projectDb
      .select({
        id: projectSchema.comments.id,
        taskId: projectSchema.comments.taskId,
        userId: projectSchema.comments.userId,
        content: projectSchema.comments.content,
        createdAt: projectSchema.comments.createdAt,
        editedAt: projectSchema.comments.editedAt,
      })
      .from(projectSchema.comments)
      .where(eq(projectSchema.comments.taskId, taskId))
      .orderBy(desc(projectSchema.comments.createdAt));

    return comments;
  }

  /**
   * Get a single comment by ID
   */
  async findOne(projectId: string, taskId: string, commentId: string) {
    // Get project namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId))
      .limit(1);

    if (!project[0]) {
      throw new NotFoundException('Project not found');
    }

    const projectDb = await this.drizzle.getProjectDb(project[0].dbNamespace);

    const comment = await projectDb
      .select({
        id: projectSchema.comments.id,
        taskId: projectSchema.comments.taskId,
        userId: projectSchema.comments.userId,
        content: projectSchema.comments.content,
        createdAt: projectSchema.comments.createdAt,
        editedAt: projectSchema.comments.editedAt,
      })
      .from(projectSchema.comments)
      .where(
        and(
          eq(projectSchema.comments.id, commentId),
          eq(projectSchema.comments.taskId, taskId),
        ),
      )
      .limit(1);

    if (!comment[0]) {
      throw new NotFoundException('Comment not found');
    }

    return comment[0];
  }

  /**
   * Update a comment (only by the author)
   */
  async update(
    projectId: string,
    taskId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    // Get project namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId))
      .limit(1);

    if (!project[0]) {
      throw new NotFoundException('Project not found');
    }

    const projectDb = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Verify comment exists and belongs to user
    const existingComment = await projectDb
      .select({
        id: projectSchema.comments.id,
        userId: projectSchema.comments.userId,
      })
      .from(projectSchema.comments)
      .where(
        and(
          eq(projectSchema.comments.id, commentId),
          eq(projectSchema.comments.taskId, taskId),
        ),
      )
      .limit(1);

    if (!existingComment[0]) {
      throw new NotFoundException('Comment not found');
    }

    if (existingComment[0].userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    // Update comment
    const result = await projectDb
      .update(projectSchema.comments)
      .set({
        content: dto.content,
        editedAt: new Date(),
      })
      .where(eq(projectSchema.comments.id, commentId))
      .returning({
        id: projectSchema.comments.id,
        taskId: projectSchema.comments.taskId,
        userId: projectSchema.comments.userId,
        content: projectSchema.comments.content,
        createdAt: projectSchema.comments.createdAt,
        editedAt: projectSchema.comments.editedAt,
      });

    this.logger.log(`Comment ${commentId} updated by user ${userId}`);
    return result[0];
  }

  /**
   * Delete a comment (only by the author or project admin/owner)
   */
  async remove(
    projectId: string,
    taskId: string,
    commentId: string,
    userId: string,
  ) {
    // Get project namespace
    const project = await this.drizzle
      .getGlobalDb()
      .select({ dbNamespace: globalSchema.projects.dbNamespace })
      .from(globalSchema.projects)
      .where(eq(globalSchema.projects.id, projectId))
      .limit(1);

    if (!project[0]) {
      throw new NotFoundException('Project not found');
    }

    const projectDb = await this.drizzle.getProjectDb(project[0].dbNamespace);

    // Verify comment exists
    const existingComment = await projectDb
      .select({
        id: projectSchema.comments.id,
        userId: projectSchema.comments.userId,
      })
      .from(projectSchema.comments)
      .where(
        and(
          eq(projectSchema.comments.id, commentId),
          eq(projectSchema.comments.taskId, taskId),
        ),
      )
      .limit(1);

    if (!existingComment[0]) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user is comment author
    const isAuthor = existingComment[0].userId === userId;

    // Check if user is project admin/owner
    const userAccess = await this.drizzle
      .getGlobalDb()
      .select({ role: globalSchema.projectAccess.role })
      .from(globalSchema.projectAccess)
      .where(
        and(
          eq(globalSchema.projectAccess.projectId, projectId),
          eq(globalSchema.projectAccess.userId, userId),
        ),
      )
      .limit(1);

    const isAdminOrOwner =
      userAccess[0] &&
      (userAccess[0].role === 'owner' || userAccess[0].role === 'admin');

    if (!isAuthor && !isAdminOrOwner) {
      throw new ForbiddenException(
        'You can only delete your own comments or be a project admin/owner',
      );
    }

    // Delete comment
    await projectDb
      .delete(projectSchema.comments)
      .where(eq(projectSchema.comments.id, commentId));

    this.logger.log(`Comment ${commentId} deleted by user ${userId}`);
    return { message: 'Comment deleted successfully' };
  }
}
