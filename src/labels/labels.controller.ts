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
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Controller('projects/:projectId/labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.labelsService.create(projectId, dto);
  }

  @Get()
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
  assignToTask(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('labelId', new ParseUUIDPipe()) labelId: string,
  ) {
    return this.labelsService.assignToTask(projectId, taskId, labelId);
  }

  @Delete('tasks/:taskId/remove/:labelId')
  removeFromTask(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('labelId', new ParseUUIDPipe()) labelId: string,
  ) {
    return this.labelsService.removeFromTask(projectId, taskId, labelId);
  }

  @Get('tasks/:taskId')
  getTaskLabels(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.labelsService.getTaskLabels(projectId, taskId);
  }
}
