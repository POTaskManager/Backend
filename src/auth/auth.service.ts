import { Injectable, NotFoundException } from '@nestjs/common';
import { GoogleMockService, OAuthTokenSet } from './google-mock.service';
import { TokenStoreService } from './token-store.service';
import { ExchangeAuthCodeDto } from './dto/exchange-auth-code.dto';
import { UserInfoRequestDto } from './dto/userinfo-request.dto';
import { SessionRecord, SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly googleMock: GoogleMockService,
    private readonly tokenStore: TokenStoreService,
    private readonly sessionService: SessionService,
  ) {}

  async exchangeAuthorizationCode(dto: ExchangeAuthCodeDto) {
    if (dto.provider !== 'google') {
      throw new NotFoundException('Only google provider mock is available right now');
    }

    const tokenSet = await this.googleMock.exchangeAuthorizationCode(dto.authorizationCode);

    if (dto.userId) {
      await this.tokenStore.save(dto.userId, dto.provider, tokenSet);
    }

    return tokenSet;
  }

  async fetchUserInfo(dto: UserInfoRequestDto) {
    const profile = await this.googleMock.fetchUserInfo(dto.accessToken);
    if (!profile) {
      throw new NotFoundException('Unknown or expired access token');
    }
    return profile;
  }

  async createSession(dto: CreateSessionDto): Promise<SessionRecord> {
    const stored = await this.tokenStore.findLatest(dto.userId, dto.provider);
    if (!stored || stored.accessToken !== dto.accessToken) {
      throw new NotFoundException('No token found for this user/provider/access token combo');
    }

    return this.sessionService.createSession(dto.userId, dto.provider, stored);
  }

  listSessions(): SessionRecord[] {
    return this.sessionService.findAll();
  }
}
