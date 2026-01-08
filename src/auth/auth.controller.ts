import { Controller, Get, Post, Req, Res, UseGuards, Body, HttpCode, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { User } from './dto/user.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-jwt.guard';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from '../users/dto/create-user.dto';
import type { Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ 
    summary: 'Register a new user account',
    description: 'Creates a new user account with email and password authentication. The email must be unique across the system. Password is securely hashed using bcrypt before storage. Upon successful registration, the user is automatically logged in and receives JWT tokens (access + refresh) in HTTP-only cookies. No email verification required for MVP - user can immediately access the system.'
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully, returns JWT tokens',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input or email already exists' })
  async register(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(createUserDto);
    
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 15 * 60 * 1000,
    });
    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    return result;
  }

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ 
    summary: 'Login with email and password',
    description: 'Authenticates a user using email and password credentials. Password is validated against the bcrypt hash stored in the database. On success, generates new JWT access token (15 min expiry) and refresh token (7 day expiry) stored in HTTP-only secure cookies. Creates a new session record for tracking active logins. Use /auth/refresh to renew access token without re-entering credentials.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        password: { type: 'string', format: 'password', example: 'StrongPassword123' },
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
  @ApiOperation({ 
    summary: 'Logout current user',
    description: 'Terminates the current user session by invalidating the refresh token and clearing authentication cookies. The access token becomes unusable after logout (session record deleted). User must login again to obtain new tokens. All active sessions on this device are terminated.'
  })
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
  @ApiOperation({ 
    summary: 'Initiate Google OAuth login',
    description: 'Redirects the user to Google\'s OAuth consent screen for authentication. User grants permission to access their Google profile (email, name, picture). After consent, Google redirects back to /auth/google/callback with authorization code. This is the first step of OAuth2 flow - no direct API call needed, users click a "Login with Google" button that navigates to this endpoint.'
  })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth consent screen' })
  googleLogin() {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({ 
    summary: 'Google OAuth callback',
    description: 'Handles the OAuth callback from Google after user consent. Exchanges the authorization code for user profile data. If the user email exists, logs them in. If new, creates an account automatically (passwordless). Generates JWT tokens and sets HTTP-only cookies. Finally redirects to the configured frontend URL with authentication complete. Users are immediately logged in after Google authentication.'
  })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with auth cookies' })
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
  @ApiOperation({ 
    summary: 'Refresh access token using refresh token',
    description: 'Obtains a new access token using the refresh token from cookies. Access tokens expire after 15 minutes for security, but refresh tokens last 7 days. When the frontend receives a 401 error due to expired access token, it should call this endpoint to get a new access token without requiring the user to re-login. Both tokens are rotated (new access + new refresh) and stored in cookies.'
  })
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
  @ApiOperation({ 
    summary: 'Get current user profile',
    description: 'Retrieves the authenticated user\'s profile information including ID, email, name, and avatar. Also includes "hasPassword" boolean indicating if the user has set a password (false for OAuth-only accounts). Use this endpoint on app initialization to verify authentication status and populate user profile in UI. Essential for displaying user info in navigation bars and settings.'
  })
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
