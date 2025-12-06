import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateSprintDto {
  @IsUUID()
  boardId!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsString()
  @Length(2, 50)
  state!: string;
}
