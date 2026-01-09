import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SprintQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by sprint status name',
    example: 'Planning',
    enum: ['Planning', 'Active', 'Completed'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter sprints starting after this date (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter sprints starting before this date (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter sprints ending after this date (ISO 8601)',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsDateString()
  endDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter sprints ending before this date (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDateTo?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'startDate',
    enum: ['startDate', 'endDate', 'name'],
  })
  @IsOptional()
  @IsIn(['startDate', 'endDate', 'name'])
  sortBy?: 'startDate' | 'endDate' | 'name';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
