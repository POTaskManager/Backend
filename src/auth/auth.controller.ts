import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { User } from './dto/user.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-jwt.guard';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        password: {
          type: 'string',
          format: 'password',
          example: 'StrongPassword123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT tokens',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(user.id);
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 15 * 60 * 1000,
    });
    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout current user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  signOut(@CurrentUser() user: User, @Res() res: Response) {
    this.authService.signOut(user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.send({ ok: true });
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/login')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google OAuth consent screen',
  })
  googleLogin() {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with auth cookies',
  })
  async googleCallback(@CurrentUser() user: User, @Res() res: Response) {
    const response = await this.authService.login(user.id);
    const redirectUri = this.configService.getOrThrow<string>(
      'GOOGLE_AUTH_REDIRECT',
    );

    res.cookie('access_token', response.accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', response.refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${redirectUri}`);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Req() req, @Res() res: Response) {
    const result = await this.authService.refreshToken(req.user.id);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.send({ ok: true });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns current user information',
    type: User,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: User) {
    const hasPassword = await this.authService.checkHasPassword(user.id);
    return {
      ...user,
      hasPassword,
    };
  }

  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Set password for OAuth-only account' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: {
          type: 'string',
          format: 'password',
          example: 'NewStrongPassword123',
          minLength: 8,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password set successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setPassword(
    @CurrentUser() user: User,
    @Body('password') password: string,
  ) {
    if (!password || password.length < 8) {
      throw new UnauthorizedException(
        'Password must be at least 8 characters long',
      );
    }
    await this.authService.setPassword(user.id, password);
    return {
      success: true,
      message:
        'Password set successfully. You can now login with email and password.',
    };
  }

  @Get('ws-token')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get WebSocket token from existing session' })
  @ApiResponse({
    status: 200,
    description: 'Returns the access token for WebSocket connection',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - no valid session' })
  getWebSocketToken(@Req() req): { token: string } {
    // Extract the access_token from cookies
    const cookies = req.cookies;
    const token = cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException('No access token found in cookies');
    }

    return { token };
  }

  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({ 
    summary: 'Set password for OAuth-only account',
    description: 'Allows users who registered via Google OAuth to set a password for email/password login. This enables them to login without Google if needed. Password must be at least 8 characters. After setting password, user can use both Google OAuth and email/password authentication methods. Useful for account recovery if OAuth provider access is lost.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: { type: 'string', format: 'password', example: 'NewStrongPassword123', minLength: 8 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password set successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setPassword(
    @CurrentUser() user: User,
    @Body('password') password: string,
  ) {
    if (!password || password.length < 8) {
      throw new UnauthorizedException('Password must be at least 8 characters long');
    }
    await this.authService.setPassword(user.id, password);
    return { success: true, message: 'Password set successfully. You can now login with email and password.' };
  }

  @Get('me/statistics')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ 
    summary: 'Get current user statistics',
    description: 'Retrieves comprehensive statistics for the authenticated user including total tasks assigned, completed tasks, active projects, contribution metrics, and recent activity summary. Essential for personal dashboards and productivity tracking. Updates in real-time as user performs actions.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns user statistics and activity metrics',
    schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'object',
          properties: {
            assigned: { type: 'number', description: 'Total tasks currently assigned' },
            completed: { type: 'number', description: 'Total tasks completed' },
            inProgress: { type: 'number', description: 'Tasks currently in progress' },
            overdue: { type: 'number', description: 'Overdue tasks' },
          },
        },
        projects: {
          type: 'object',
          properties: {
            total: { type: 'number', description: 'Total projects user is member of' },
            owned: { type: 'number', description: 'Projects where user is owner' },
            active: { type: 'number', description: 'Projects with recent activity' },
          },
        },
        activity: {
          type: 'object',
          properties: {
            commentsPosted: { type: 'number', description: 'Total comments posted' },
            tasksCreated: { type: 'number', description: 'Total tasks created' },
            chatMessages: { type: 'number', description: 'Total chat messages sent' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserStatistics(@CurrentUser() user: User) {
    return this.authService.getUserStatistics(user.id);
  }
}
