import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
      private prisma: PrismaService,
      private jwtService: JwtService,
  ) {
    this.googleClient = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'postmessage',
    );
  }

  async loginWithGoogle(code: string) {
    let email: string;
    let firstName: string;
    let lastName: string;

    // --- MOCK (Dev) ---
    if (process.env.NODE_ENV === 'development' && code === 'mock_code') {
      console.log('Używam Mocka Google');
      email = 'mockuser@example.com';
      firstName = 'Jan';
      lastName = 'Mockowski';
    } else {
      // --- GOOGLE AUTH (Prod) ---
      try {
        const response = await this.googleClient.getToken(code);
        const tokens = response.tokens;

        // Dodano 'as any', żeby TypeScript nie marudził na typ Promise/void
        const ticket = await this.googleClient.verifyIdToken({
          idToken: tokens.id_token as string,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        // Rzutujemy na 'any', żeby ominąć sprawdzanie getPayload
        const payload = (ticket as any).getPayload();

        if (!payload || !payload.email) {
          throw new UnauthorizedException('Google nie zwróciło adresu email');
        }

        // ZMIANA: Wymuszamy konwersję na String(), żeby naprawić błąd "Type undefined is not assignable to string"
        email = String(payload.email);
        firstName = payload.given_name ? String(payload.given_name) : 'User';
        lastName = payload.family_name ? String(payload.family_name) : '';

      } catch (e) {
        console.error(e); // Ważne: zobaczysz w konsoli co dokładnie się stało
        throw new UnauthorizedException('Nieudana autoryzacja Google');
      }
    }

    // --- Baza Danych ---
    let user = await this.prisma.users.findUnique({
      where: { user_Email: email },
    });

    if (!user) {
      const randomPassword = uuidv4();
      const hash = await bcrypt.hash(randomPassword, 10);

      user = await this.prisma.users.create({
        data: {
          user_Email: email,
          user_FirstName: firstName,
          user_LastName: lastName,
          user_PasswordHash: hash,
          user_IsActive: true,
        },
      });
    }

    await this.prisma.users.update({
      where: { user_userId: user.user_userId },
      data: { user_LastLogin: new Date() },
    });

    return this.generateTokens(user);
  }

  async refreshSession(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });

      const user = await this.prisma.users.findUnique({
        where: { user_userId: payload.sub },
      });

      if (!user) throw new UnauthorizedException('Użytkownik nie istnieje');

      return this.generateTokens(user);
    } catch (e) {
      throw new UnauthorizedException('Sesja wygasła lub token jest nieprawidłowy');
    }
  }

  async logout() {
    return { message: 'Wylogowano pomyślnie' };
  }

  private async generateTokens(user: any) {
    const payload = { sub: user.user_userId, email: user.user_Email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_SECRET,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.user_userId,
        email: user.user_Email,
        firstName: user.user_FirstName,
        lastName: user.user_LastName,
      },
    };
  }
}