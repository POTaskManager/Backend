import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type {
  NotificationPreferences,
  UpdatePreferencesDto,
} from './notifications.service';
import { NotificationsService } from './notifications.service';

// ============================================
// NOTIFICATIONS CONTROLLER
// ============================================

@ApiTags('notifications')
@ApiCookieAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ============================================
  // GET PREFERENCES
  // ============================================

  @Get('preferences')
  @ApiOperation({ 
    summary: 'Get user notification preferences',
    description: 'Retrieves the current user\'s notification preferences for all notification types (email, in-app). Settings include whether to receive notifications for task assignments, comments, mentions, sprint changes, and project updates. Each notification type can be enabled/disabled independently.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns user notification preferences',
    schema: {
      type: 'object',
      properties: {
        emailEnabled: { type: 'boolean', description: 'Master email notification toggle' },
        inAppEnabled: { type: 'boolean', description: 'Master in-app notification toggle' },
        taskAssignments: { type: 'boolean' },
        taskComments: { type: 'boolean' },
        mentions: { type: 'boolean' },
        sprintUpdates: { type: 'boolean' },
        projectInvitations: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or expired token' })
  async getPreferences(@Request() req): Promise<NotificationPreferences> {
    const userId = req.user.userId;
    return this.notificationsService.getPreferences(userId);
  }

  // ============================================
  // UPDATE PREFERENCES
  // ============================================

  @Put('preferences')
  @ApiOperation({ 
    summary: 'Update notification preferences',
    description: 'Updates the current user\'s notification preferences. Allows granular control over which notification types trigger email or in-app alerts. Partial updates are supported - only include the preferences you want to change. Changes take effect immediately for future notifications.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Preferences updated successfully, returns updated preferences'
  })
  @ApiResponse({ status: 400, description: 'Invalid input - malformed preference data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or expired token' })
  async updatePreferences(
    @Request() req,
    @Body() updates: UpdatePreferencesDto
  ): Promise<NotificationPreferences> {
    const userId = req.user.userId;
    return this.notificationsService.updatePreferences(userId, updates);
  }
}
