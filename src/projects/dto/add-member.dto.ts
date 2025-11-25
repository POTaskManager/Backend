import { IsString, IsUUID } from 'class-validator';

export class AddMemberDto {
  @IsUUID()
  userId!: string;

  @IsString()
  roleId!: string;
}
