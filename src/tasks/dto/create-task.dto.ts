import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum TaskState {
  Todo = 'todo',
  InProgress = 'in_progress',
  Done = 'done',
  Blocked = 'blocked',
}

export class CreateTaskDto {
  @IsUUID()
  boardId!: string;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsUUID()
  createdBy!: string;

  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TaskState)
  state!: TaskState;

  @IsEnum(TaskPriority)
  priority!: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
