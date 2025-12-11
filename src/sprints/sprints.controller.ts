import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';
import { SprintQueryDto } from './dto/sprint-query.dto';
import { SprintsService } from './sprints.service';

@Controller('projects/:projectId/sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateSprintDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.sprintsService.create(projectId, userId, dto);
  }

  @Get()
  findAll(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() queryDto: SprintQueryDto,
  ) {
    return this.sprintsService.findAll(projectId, queryDto);
  }

  @Get(':id/report')
  getReport(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) sprintId: string,
  ) {
    return this.sprintsService.getReport(projectId, sprintId);
  }

  @Get(':id/view')
  getSprintView(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) sprintId: string,
  ) {
    return this.sprintsService.getSprintView(projectId, sprintId);
  }

  @Get(':id')
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sprintsService.findOne(projectId, id);
  }

  @Put(':id/start')
  startSprint(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) sprintId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.sprintsService.start(projectId, sprintId, userId);
  }

  @Put(':id/complete')
  completeSprint(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) sprintId: string,
    @Body() dto: CompleteSprintDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.sprintsService.complete(projectId, sprintId, userId, dto);
  }

  @Put(':id')
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) sprintId: string,
    @Body() dto: UpdateSprintDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.sprintsService.update(projectId, sprintId, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) sprintId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.sprintsService.remove(projectId, sprintId, userId);
  }
}
