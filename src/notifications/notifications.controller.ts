import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type {
  NotificationPreferences,
  UpdatePreferencesDto,
} from './notifications.service';
import { NotificationsService } from './notifications.service';

// ============================================
// NOTIFICATIONS CONTROLLER
// ============================================

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ============================================
  // GET PREFERENCES
  // ============================================

  @Get('preferences')
  async getPreferences(@Request() req): Promise<NotificationPreferences> {
    const userId = req.user.userId;
    return this.notificationsService.getPreferences(userId);
  }

  // ============================================
  // UPDATE PREFERENCES
  // ============================================

  @Put('preferences')
  async updatePreferences(
    @Request() req,
    @Body() updates: UpdatePreferencesDto
  ): Promise<NotificationPreferences> {
    const userId = req.user.userId;
    return this.notificationsService.updatePreferences(userId, updates);
  }
}
