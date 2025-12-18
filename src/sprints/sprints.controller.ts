import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
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
    return this.sprintsService.create(projectId, dto, req.user.id);
  }

  @Get()
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.sprintsService.findAll(projectId);
  }

  @Get(':id')
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sprintsService.findOne(projectId, id);
  }

  @Put(':id')
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSprintDto,
    @Req() req: any,
  ) {
    return this.sprintsService.update(projectId, id, dto, req.user.id);
  }

  @Post(':id/start')
  @HttpCode(200)
  start(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.sprintsService.startSprint(projectId, id, req.user.id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.sprintsService.completeSprint(projectId, id, req.user.id);
  }

  @Get(':id/statistics')
  getStatistics(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sprintsService.getSprintStatistics(projectId, id);
  }

  @Get(':id/view')
  getSprintView(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sprintsService.getSprintView(projectId, id);
  }
}
