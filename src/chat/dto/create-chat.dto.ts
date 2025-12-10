import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsOptional()
  chat_name?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  memberIds?: string[];
}
