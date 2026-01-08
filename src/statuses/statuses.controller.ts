import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiCookieAuth } from '@nestjs/swagger';
import { StatusesService } from './statuses.service';

@ApiTags('statuses')
@ApiCookieAuth()
@Controller('projects/:projectId/statuses')
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get all task statuses',
    description: 'Retrieves all available task statuses for the project (e.g., TODO, In Progress, Review, Done). Each status has a name, color, and position in the workflow. Used to populate status selectors and validate status transitions.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID to fetch statuses from' })
  @ApiResponse({ status: 200, description: 'Returns array of task statuses with workflow order' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.statusesService.findAll(projectId);
  }

  @Get('columns')
  @ApiOperation({ 
    summary: 'Get Kanban board columns with task counts',
    description: 'Retrieves all Kanban board columns mapped to task statuses, including the number of tasks in each column. Essential for rendering the Kanban board view with accurate task counts per column.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID to fetch columns from' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns array of columns with status mappings and task counts',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          statusId: { type: 'string' },
          taskCount: { type: 'number' },
          order: { type: 'number' }
        }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findColumns(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.statusesService.findColumns(projectId);
  }
}
