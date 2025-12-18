import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateSprintDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  goal?: string;
}
