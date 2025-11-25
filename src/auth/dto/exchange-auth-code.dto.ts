import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ExchangeAuthCodeDto {
  @IsString()
  provider!: string;

  @IsString()
  authorizationCode!: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  codeVerifier?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
