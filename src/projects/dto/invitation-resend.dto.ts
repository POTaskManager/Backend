import { IsEmail, IsOptional, IsString } from 'class-validator';

export class InvitationResendDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  invitedBy?: string;

  @IsOptional()
  @IsString()
  roleId?: string;
}
