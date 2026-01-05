import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ 
    description: 'Project name', 
    minLength: 1, 
    maxLength: 200,
    example: 'My Awesome Project',
  })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ 
    description: 'Project description',
    example: 'A project for managing awesome tasks',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Array of user emails to invite',
    type: [String],
    example: ['user1@example.com', 'user2@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  memberEmails?: string[];
}
