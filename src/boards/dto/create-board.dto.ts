import { IsIn, IsString, Length } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @IsIn(['kanban', 'scrum', 'custom'])
  type!: string;
}
