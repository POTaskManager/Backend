import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    // Override projectId from URL (security: prevent body manipulation)
    dto.projectId = projectId;
    return this.tasksService.create(dto);
  }

  @Get()
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.tasksService.findAll(projectId);
  }

  @Get(':id')
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tasksService.findOne(projectId, id);
  }
}
