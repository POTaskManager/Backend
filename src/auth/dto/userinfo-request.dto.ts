import { IsString } from 'class-validator';

export class UserInfoRequestDto {
  @IsString()
  accessToken!: string;
}
