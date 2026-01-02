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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/dto/user.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.create(projectId, dto, user.id);
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

  @Put(':id')
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
  delete(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: any,
  ) {
    const userId = request.user?.sub;
    return this.tasksService.softDelete(projectId, id, userId);
  }

  @Put(':id/status')
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
