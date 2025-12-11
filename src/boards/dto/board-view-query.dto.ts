import { IsOptional, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum FilterBy {
  ASSIGNED_TO_ME = 'assigned_to_me',
  PRIORITY_HIGH = 'priority_high',
  PRIORITY_MEDIUM = 'priority_medium',
  PRIORITY_LOW = 'priority_low',
}

export enum SortBy {
  DUE_DATE = 'due_date',
  PRIORITY = 'priority',
  CREATED_AT = 'created_at',
}

export class BoardViewQueryDto {
  @IsOptional()
  @IsUUID()
  sprint_id?: string;

  @IsOptional()
  @IsEnum(FilterBy)
  filter_by?: FilterBy;

  @IsOptional()
  @IsEnum(SortBy)
  sort_by?: SortBy;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority_min?: number;
}
