import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiCookieAuth } from '@nestjs/swagger';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@ApiTags('labels')
@ApiCookieAuth()
@Controller('projects/:projectId/labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new label',
    description: 'Creates a custom label for categorizing and organizing tasks within the project. Labels can represent types (Bug, Feature, Enhancement), priorities (High, Low), or any custom categories. Each label has a name and color for visual distinction on Kanban boards.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID where the label will be created' })
  @ApiResponse({ status: 201, description: 'Label created successfully with assigned color' })
  @ApiResponse({ status: 400, description: 'Invalid input - label name required or already exists' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.labelsService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all labels in project',
    description: 'Retrieves all custom labels defined for the project. Use this endpoint to populate label selectors in the UI when creating or editing tasks, or to display label filters for task views.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID to fetch labels from' })
  @ApiResponse({ status: 200, description: 'Returns array of labels with names, colors, and usage statistics' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.labelsService.findAll(projectId);
  }

  @Get(':id')
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.labelsService.findOne(projectId, id);
  }

  @Put(':id')
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.labelsService.update(projectId, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.labelsService.remove(projectId, id);
  }

  @Post('tasks/:taskId/assign/:labelId')
  @ApiOperation({ 
    summary: 'Assign label to task',
    description: 'Assigns an existing label to a task for categorization and organization. A task can have multiple labels simultaneously (e.g., "Bug" + "High Priority"). The label will be visible on the task card in Kanban views.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID to assign the label to' })
  @ApiParam({ name: 'labelId', description: 'Label UUID to assign' })
  @ApiResponse({ status: 201, description: 'Label assigned to task successfully' })
  @ApiResponse({ status: 400, description: 'Label already assigned to this task' })
  @ApiResponse({ status: 404, description: 'Task or label not found' })
  assignToTask(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('labelId', new ParseUUIDPipe()) labelId: string,
  ) {
    return this.labelsService.assignToTask(projectId, taskId, labelId);
  }

  @Delete('tasks/:taskId/remove/:labelId')
  @ApiOperation({ 
    summary: 'Remove label from task',
    description: 'Removes a previously assigned label from a task. The label itself remains in the project and can be reassigned to other tasks.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID to remove the label from' })
  @ApiParam({ name: 'labelId', description: 'Label UUID to remove' })
  @ApiResponse({ status: 200, description: 'Label removed from task successfully' })
  @ApiResponse({ status: 404, description: 'Task, label, or assignment not found' })
  removeFromTask(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('labelId', new ParseUUIDPipe()) labelId: string,
  ) {
    return this.labelsService.removeFromTask(projectId, taskId, labelId);
  }

  @Get('tasks/:taskId')
  @ApiOperation({ 
    summary: 'Get all labels assigned to a task',
    description: 'Retrieves all labels currently assigned to a specific task. Use this to display task labels in task detail views or when rendering task cards.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID to fetch labels for' })
  @ApiResponse({ status: 200, description: 'Returns array of labels assigned to the task' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  getTaskLabels(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.labelsService.getTaskLabels(projectId, taskId);
  }
}
