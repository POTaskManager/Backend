import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';

@Controller('projects/:projectId/boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardsService.create(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.boardsService.findAll(projectId);
  }

  @Get('workflow')
  getWorkflow(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.boardsService.getWorkflow(projectId);
  }

  @Get(':id')
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.boardsService.findOne(projectId, id);
  }

  @Post('reorder')
  @HttpCode(200)
  reorder(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: ReorderColumnsDto,
  ) {
    return this.boardsService.reorderColumns(projectId, dto.columnOrders);
  }
}
