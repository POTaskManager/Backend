import { IsIn, IsString, IsUUID, Length } from 'class-validator';

export class CreateBoardDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @IsIn(['kanban', 'scrum', 'custom'])
  type!: string;
}
