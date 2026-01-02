import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000, { message: 'Comment cannot exceed 5000 characters' })
  content: string;
}
