import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum MoveIncompleteTo {
  BACKLOG = 'backlog',
  NEXT_SPRINT = 'next_sprint',
}

export class CompleteSprintDto {
  @IsOptional()
  @IsEnum(MoveIncompleteTo)
  moveIncompleteTo?: MoveIncompleteTo;

  @IsOptional()
  @IsUUID('4')
  nextSprintId?: string;
}
