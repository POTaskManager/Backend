import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { SprintQueryDto } from './dto/sprint-query.dto';
import { SprintsService } from './sprints.service';

@ApiTags('sprints')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('projects/:projectId/sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sprint' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Sprint created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid status name' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateSprintDto,
    @Req() req: any,
  ) {
    return this.sprintsService.create(projectId, dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sprints with optional filters' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by sprint status (Planning, Active, Completed)' })
  @ApiQuery({ name: 'startDateFrom', required: false, description: 'Filter sprints starting after this date' })
  @ApiQuery({ name: 'startDateTo', required: false, description: 'Filter sprints starting before this date' })
  @ApiQuery({ name: 'endDateFrom', required: false, description: 'Filter sprints ending after this date' })
  @ApiQuery({ name: 'endDateTo', required: false, description: 'Filter sprints ending before this date' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['startDate', 'endDate', 'name'], description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'List of sprints returned successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findAll(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() queryDto: SprintQueryDto,
  ) {
    return this.sprintsService.findAll(projectId, queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sprint by ID' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint returned successfully' })
  @ApiResponse({ status: 404, description: 'Sprint or project not found' })
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sprintsService.findOne(projectId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update sprint' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint updated successfully' })
  @ApiResponse({ status: 404, description: 'Sprint or project not found' })
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
  @ApiOperation({ summary: 'Start a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint started successfully' })
  @ApiResponse({ status: 400, description: 'Sprint cannot be started (invalid status)' })
  @ApiResponse({ status: 404, description: 'Sprint or project not found' })
  start(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.sprintsService.startSprint(projectId, id, req.user.id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint completed successfully' })
  @ApiResponse({ status: 400, description: 'Sprint cannot be completed (invalid status)' })
  @ApiResponse({ status: 404, description: 'Sprint or project not found' })
  complete(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.sprintsService.completeSprint(projectId, id, req.user.id);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get sprint statistics' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint statistics returned successfully' })
  @ApiResponse({ status: 404, description: 'Sprint or project not found' })
  getStatistics(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sprintsService.getSprintStatistics(projectId, id);
  }

  @Get(':id/view')
  @ApiOperation({ summary: 'Get sprint Kanban board view' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint view returned successfully' })
  @ApiResponse({ status: 404, description: 'Sprint or project not found' })
  getSprintView(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sprintsService.getSprintView(projectId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a sprint (Planning status only)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 204, description: 'Sprint deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete sprint - not in Planning status' })
  @ApiResponse({ status: 404, description: 'Sprint or project not found' })
  remove(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.sprintsService.remove(projectId, id, req.user.id);
  }
}
