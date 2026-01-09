import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiCookieAuth } from '@nestjs/swagger';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';

@ApiTags('boards')
@ApiCookieAuth()
@Controller('projects/:projectId/boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new Kanban board',
    description: 'Creates a customizable Kanban board for the project with configurable columns and workflow states. Each board can have multiple columns representing different stages of work (e.g., Backlog, Todo, In Progress, Review, Done).'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID where the board will be created' })
  @ApiResponse({ status: 201, description: 'Kanban board created successfully with default columns' })
  @ApiResponse({ status: 400, description: 'Invalid input - board name or configuration invalid' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardsService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all Kanban boards in project',
    description: 'Retrieves all Kanban boards configured for the project. Each board contains columns, workflow configuration, and associated tasks. Useful for displaying multiple board views or selecting which board to work with.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID to fetch boards from' })
  @ApiResponse({ status: 200, description: 'Returns array of Kanban boards with their configurations and columns' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.boardsService.findAll(projectId);
  }

  @Get('workflow')
  @ApiOperation({ 
    summary: 'Get project workflow configuration',
    description: 'Retrieves the complete workflow configuration for the project, including all available task statuses, their allowed transitions, and the board column mappings. This is essential for validating task status changes and drag-and-drop operations on Kanban boards.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID to fetch workflow from' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns workflow configuration with status transitions and column mappings',
    schema: {
      type: 'object',
      properties: {
        statuses: { type: 'array', description: 'Available task statuses' },
        transitions: { type: 'array', description: 'Allowed status transitions' },
        columns: { type: 'array', description: 'Board column configurations' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  getWorkflow(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.boardsService.getWorkflow(projectId);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get Kanban board by ID',
    description: 'Retrieves detailed information about a specific Kanban board, including all its columns, tasks organized by status, and board configuration settings. Use this endpoint to render a complete board view with all tasks.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID containing the board' })
  @ApiParam({ name: 'id', description: 'Board UUID to retrieve' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns board details with columns and tasks',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        columns: { type: 'array', description: 'Board columns with tasks' },
        configuration: { type: 'object', description: 'Board settings' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Board or project not found' })
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.boardsService.findOne(projectId, id);
  }

  @Post('reorder')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'Reorder board columns',
    description: 'Changes the display order of columns on the Kanban board. This allows users to customize their board layout by rearranging columns (e.g., moving "Review" column before "Done"). The new order is persisted and applies to all users viewing this board.'
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID containing the board' })
  @ApiResponse({ status: 200, description: 'Columns reordered successfully, returns updated board configuration' })
  @ApiResponse({ status: 400, description: 'Invalid column order data' })
  @ApiResponse({ status: 403, description: 'Access denied - user not a project member' })
  @ApiResponse({ status: 404, description: 'Project or columns not found' })
  reorder(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: ReorderColumnsDto,
  ) {
    return this.boardsService.reorderColumns(projectId, dto.columnOrders);
  }
}
