import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiCookieAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/dto/user.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiCookieAuth()
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new task',
    description: 'Creates a new task in the project with title, description, assignees, labels, sprint assignment, and initial status. Tasks are the fundamental work items that flow through the Kanban board. Each task can have multiple contributors, labels, comments, and file attachments. The creator is automatically recorded for audit purposes.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.create(projectId, dto, user.id);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all tasks in project',
    description: 'Retrieves all tasks in the project with their current status, assignees, labels, and metadata. Returns both active and completed tasks. Use this for generating task lists, reports, and analytics. For Kanban board views, tasks are grouped by status/column. Supports filtering by sprint, status, assignee, and labels via query parameters.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of tasks' })
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.tasksService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get task by ID',
    description: 'Retrieves complete task details including title, description, status, assignees, labels, comments, file attachments, sprint assignment, creation/update timestamps, and audit history. Essential for displaying task detail modals and edit forms. Includes related entities for full context.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Returns task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tasksService.findOne(projectId, id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update task',
    description: 'Updates task properties such as title, description, assignees, labels, or sprint assignment. All changes are recorded in the audit log with timestamp and user. Notifications are sent to affected users (newly assigned contributors, mentioned users). Use PUT for complete updates or PATCH for partial updates.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: any,
  ) {
    const userId = request.user?.sub;
    return this.tasksService.update(projectId, id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete task',
    description: 'Performs a soft delete on the task, marking it as deleted without removing it from the database. The task is hidden from normal views but preserved for audit and recovery purposes. Related data (comments, labels) are preserved. Hard deletion requires database-level operations. Deleted tasks can be filtered out or recovered by administrators.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  delete(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: any,
  ) {
    const userId = request.user?.sub;
    return this.tasksService.softDelete(projectId, id, userId);
  }

  @Put(':id/status')
  @ApiOperation({ 
    summary: 'Change task status',
    description: 'Updates the task status (e.g., from "In Progress" to "Done"). This endpoint is called during Kanban drag-and-drop operations when moving tasks between columns. Status transitions are validated against the workflow configuration. Status changes are recorded in the audit log and may trigger notifications to task assignees.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task status changed successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  changeStatus(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() request: any,
  ) {
    const userId = request.user?.sub;
    return this.tasksService.changeStatus(projectId, id, dto.statusId, userId);
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Partially update task',
    description: 'Performs a partial update on task properties. Unlike PUT which expects all fields, PATCH allows updating only specific fields (e.g., just the title or just the assignees). Useful for quick edits without fetching and sending the entire task object. Changes are audited and may trigger notifications.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task partially updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  partialUpdate(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: any,
  ) {
    const userId = request.user?.sub;
    return this.tasksService.update(projectId, id, dto, userId);
  }
}

// Backlog endpoint będzie w projects controller jako /projects/:projectId/backlog
