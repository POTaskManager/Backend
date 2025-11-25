import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
  scope: string[];
  idToken?: string;
  userProfile: {
    sub: string;
    email: string;
    name: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
}

@Injectable()
export class GoogleMockService {
  private readonly tokenToUser = new Map<string, OAuthTokenSet['userProfile']>();

  async exchangeAuthorizationCode(code: string): Promise<OAuthTokenSet> {
    const userProfile = this.resolveUserFromCode(code);
    const accessToken = randomBytes(24).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // +1h
    const tokenSet: OAuthTokenSet = {
      accessToken,
      refreshToken,
      expiresAt,
      tokenType: 'Bearer',
      scope: ['openid', 'email', 'profile'],
      idToken: randomBytes(32).toString('hex'),
      userProfile,
    };

    this.tokenToUser.set(accessToken, userProfile);
    return tokenSet;
  }

  async fetchUserInfo(accessToken: string) {
    const profile = this.tokenToUser.get(accessToken);
    if (!profile) {
      return null;
    }

    return profile;
  }

  private resolveUserFromCode(code: string): OAuthTokenSet['userProfile'] {
    // Allows deterministic mock user creation e.g. "code:USER_EMAIL"
    const [, candidate] = code.split(':');
    if (candidate) {
      return {
        sub: randomUUID(),
        email: candidate,
        name: candidate,
      };
    }

    return {
      sub: randomUUID(),
      email: 'mockuser@example.com',
      name: 'Mock User',
      given_name: 'Mock',
      family_name: 'User',
    };
  }
}
