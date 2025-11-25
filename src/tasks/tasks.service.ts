import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTaskDto) {
    return this.prisma.tasks.create({
      data: {
        task_BoardId: dto.boardId,
        task_SprintId: dto.sprintId,
        task_AssignedTo: dto.assignedTo,
        task_CreationBy: dto.createdBy,
        task_Title: dto.title,
        task_Description: dto.description,
        task_State: dto.state,
        task_Priority: dto.priority,
        task_DueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      select: {
        task_taskId: true,
        task_BoardId: true,
        task_SprintId: true,
        task_AssignedTo: true,
        task_CreationBy: true,
        task_Title: true,
        task_Description: true,
        task_State: true,
        task_Priority: true,
        task_DueDate: true,
        task_CreationDate: true,
        task_ModificationDate: true,
      },
    });
  }

  findAll() {
    return this.prisma.tasks.findMany({
      select: {
        task_taskId: true,
        task_BoardId: true,
        task_SprintId: true,
        task_AssignedTo: true,
        task_CreationBy: true,
        task_Title: true,
        task_Description: true,
        task_State: true,
        task_Priority: true,
        task_DueDate: true,
        task_CreationDate: true,
        task_ModificationDate: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.tasks.findUnique({
      where: { task_taskId: id },
      select: {
        task_taskId: true,
        task_BoardId: true,
        task_SprintId: true,
        task_AssignedTo: true,
        task_CreationBy: true,
        task_Title: true,
        task_Description: true,
        task_State: true,
        task_Priority: true,
        task_DueDate: true,
        task_CreationDate: true,
        task_ModificationDate: true,
      },
    });
  }
}
