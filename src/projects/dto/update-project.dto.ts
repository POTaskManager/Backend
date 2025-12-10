import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
