import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { BoardViewQueryDto } from './dto/board-view-query.dto';

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

  @Get('view')
  getBoardView(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() queryDto: BoardViewQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.boardsService.getBoardView(projectId, userId, queryDto);
  }

  @Get(':id')
  findOne(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.boardsService.findOne(projectId, id);
  }
}
