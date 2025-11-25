import { IsString, IsUUID } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsUUID()
  userId!: string;
}
