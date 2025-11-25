import {
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  Length,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(1, 120)
  firstName!: string;

  @IsString()
  @Length(1, 120)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsStrongPassword({ minLength: 8, minSymbols: 0 })
  password!: string;

  @IsOptional()
  @IsString()
  preferredLocale?: string;
}
