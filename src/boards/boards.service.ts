import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBoardDto) {
    return this.prisma.boards.create({
      data: {
        board_ProjectId: dto.projectId,
        board_Name: dto.name,
        board_Type: dto.type,
      },
      select: {
        board_boardId: true,
        board_ProjectId: true,
        board_Name: true,
        board_Type: true,
        board_CreationDate: true,
      },
    });
  }

  findAll() {
    return this.prisma.boards.findMany({
      select: {
        board_boardId: true,
        board_ProjectId: true,
        board_Name: true,
        board_Type: true,
        board_CreationDate: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.boards.findUnique({
      where: { board_boardId: id },
      select: {
        board_boardId: true,
        board_ProjectId: true,
        board_Name: true,
        board_Type: true,
        board_CreationDate: true,
      },
    });
  }
}
