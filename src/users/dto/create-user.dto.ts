import {
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ 
    description: 'User first name', 
    minLength: 1, 
    maxLength: 120,
    example: 'John',
  })
  @IsString()
  @Length(1, 120)
  firstName!: string;

  @ApiProperty({ 
    description: 'User last name', 
    minLength: 1, 
    maxLength: 120,
    example: 'Doe',
  })
  @IsString()
  @Length(1, 120)
  lastName!: string;

  @ApiProperty({ 
    description: 'User email address', 
    format: 'email',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ 
    description: 'Strong password (min 8 characters)', 
    minLength: 8,
    example: 'StrongPassword123',
  })
  @IsStrongPassword({ minLength: 8, minSymbols: 0 })
  password!: string;

  @ApiPropertyOptional({ 
    description: 'Preferred locale/language', 
    example: 'en-US',
  })
  @IsOptional()
  @IsString()
  preferredLocale?: string;
}
