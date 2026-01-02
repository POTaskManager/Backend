import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { StatusesService } from './statuses.service';

@Controller('projects/:projectId/statuses')
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Get()
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.statusesService.findAll(projectId);
  }

  @Get('columns')
  findColumns(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.statusesService.findColumns(projectId);
  }
}
