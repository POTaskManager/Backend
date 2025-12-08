import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const redirectUri = request.query.redirect_uri;

    if (redirectUri && !this.isValidRedirectUri(redirectUri)) {
      throw new UnauthorizedException('Invalid redirect URI');
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  private isValidRedirectUri(uri: string): boolean {
    const redirectUri = this.configService.getOrThrow<string>(
      'GOOGLE_AUTH_REDIRECT',
    );
    const allowedDomains = [redirectUri];
    try {
      const url = new URL(uri);
      return allowedDomains.some((domain) => url.origin === domain);
    } catch {
      return false;
    }
  }
}
