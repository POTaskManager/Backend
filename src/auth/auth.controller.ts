import { Body, Controller, Get, Post, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { ExchangeAuthCodeDto } from './dto/exchange-auth-code.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Zadanie #7 i #8: Endpoint do logowania
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() dto: ExchangeAuthCodeDto) {
    return this.authService.loginWithGoogle(dto.code);
  }

  // Zadanie #10: Endpoint do odświeżania sesji
  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  async createSession(@Body() dto: CreateSessionDto) {
    return this.authService.refreshSession(dto.refreshToken);
  }

  // Zadanie #9: Pobieranie profilu (zabezpieczone tokenem)
  @UseGuards(AuthGuard('jwt'))
  @Post('oauth/userinfo')
  @HttpCode(HttpStatus.OK)
  async userInfo(@Req() req) {
    return req.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return this.authService.logout();
  }
}