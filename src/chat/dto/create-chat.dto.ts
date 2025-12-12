import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsOptional()
  chatName?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  memberIds?: string[];
}
