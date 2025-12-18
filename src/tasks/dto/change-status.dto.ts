import { IsUUID } from 'class-validator';

export class ChangeStatusDto {
  @IsUUID('4')
  statusId!: string;
}
