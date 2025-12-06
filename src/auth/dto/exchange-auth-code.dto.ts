import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeAuthCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
