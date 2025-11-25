import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ExchangeAuthCodeDto } from './dto/exchange-auth-code.dto';
import { UserInfoRequestDto } from './dto/userinfo-request.dto';
import { SessionRecord } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('oauth/exchange')
  exchange(@Body() dto: ExchangeAuthCodeDto) {
    return this.authService.exchangeAuthorizationCode(dto);
  }

  @Post('oauth/userinfo')
  userInfo(@Body() dto: UserInfoRequestDto) {
    return this.authService.fetchUserInfo(dto);
  }

  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto): Promise<SessionRecord> {
    return this.authService.createSession(dto);
  }

  @Get('sessions')
  listSessions(): SessionRecord[] {
    return this.authService.listSessions();
  }
}
