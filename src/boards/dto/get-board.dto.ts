import { IsOptional, IsUUID, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetBoardDto {
  @IsOptional()
  @IsUUID()
  sprint_id?: string;

  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority_min?: number;

  @IsOptional()
  @IsIn(['due_date', 'priority', 'created_at'])
  sort_by?: 'due_date' | 'priority' | 'created_at';

  @IsOptional()
  @IsIn(['assigned_to_me', 'priority'])
  filter_by?: 'assigned_to_me' | 'priority';
}
