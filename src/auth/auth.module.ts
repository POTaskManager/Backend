import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleMockService } from './google-mock.service';
import { SessionService } from './session.service';
import { TokenStoreService } from './token-store.service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleMockService, TokenStoreService, SessionService],
})
export class AuthModule {}
