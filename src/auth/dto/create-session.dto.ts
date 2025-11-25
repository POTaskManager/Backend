import { IsString, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  userId!: string;

  @IsString()
  provider!: string;

  @IsString()
  accessToken!: string;
}
