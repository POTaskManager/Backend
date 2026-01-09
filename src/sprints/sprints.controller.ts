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
  @ApiOperation({ 
    summary: 'Create a new sprint',
    description: 'Creates a new sprint (iteration) for organizing tasks into time-boxed work periods. Sprints have three states: Planning (tasks being added), Active (work in progress), and Completed (finished). Each sprint has start/end dates, goals, and associated tasks. Only one sprint can be active at a time per project. New sprints start in "Planning" status.'
  })
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
  @ApiOperation({ 
    summary: 'Get all sprints with optional filters',
    description: 'Retrieves all sprints for the project with optional filtering by status (Planning/Active/Completed), date ranges, and sorting options. Returns sprint metadata, task counts, completion statistics, and timeline information. Essential for sprint planning views, burndown charts, and project timeline visualization.'
  })
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
  @ApiOperation({ 
    summary: 'Get sprint by ID',
    description: 'Retrieves detailed information about a specific sprint including name, description, goals, start/end dates, current status, associated tasks, and progress metrics. Use this for sprint detail views, retrospectives, and planning sessions. Includes task breakdown by status for progress tracking.'
  })
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
  @ApiOperation({ 
    summary: 'Update sprint',
    description: 'Updates sprint properties such as name, description, goals, or dates. Cannot change sprint status through this endpoint - use /start or /complete instead. Active or completed sprints may have restrictions on date changes to preserve historical accuracy. Changes are audited and may notify team members.'
  })
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
  @ApiOperation({ 
    summary: 'Start a sprint',
    description: 'Transitions a sprint from "Planning" to "Active" status, officially beginning the iteration work period. Only one sprint can be active at a time - starting a new sprint automatically completes any currently active sprint. Tasks assigned to the sprint become locked to prevent scope changes. Teams begin daily standups and progress tracking. Records actual start timestamp.'
  })
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
  @ApiOperation({ 
    summary: 'Complete a sprint',
    description: 'Transitions an active sprint to "Completed" status, closing the iteration and triggering retrospective workflows. Incomplete tasks can be moved to the backlog or next sprint. Final statistics are calculated (velocity, completion rate, burndown). Completion timestamp is recorded for historical tracking and velocity calculations. Triggers sprint review and retrospective notifications to team.'
  })
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
  @ApiOperation({ 
    summary: 'Get sprint statistics',
    description: 'Retrieves comprehensive sprint metrics including total/completed/in-progress task counts, completion percentage, velocity (story points completed), burndown data, and daily progress tracking. Essential for generating sprint reports, burndown charts, velocity graphs, and retrospective analytics. Updated in real-time as tasks move through the workflow.'
  })
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
  @ApiOperation({ 
    summary: 'Get sprint Kanban board view',
    description: 'Retrieves a complete Kanban board view for the sprint with all tasks organized by status columns (Backlog, Todo, In Progress, Review, Done). Each task includes title, assignees, labels, and priority. Essential for rendering sprint board UI with drag-and-drop functionality. Filters tasks to only those assigned to this specific sprint.'
  })
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
  @ApiOperation({ 
    summary: 'Delete a sprint (Planning status only)',
    description: 'Permanently deletes a sprint that is still in "Planning" status. Active or Completed sprints cannot be deleted to preserve historical data and metrics. Tasks assigned to the deleted sprint are moved back to the backlog. Use this to remove sprints created by mistake or no longer needed before they start.'
  })
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
