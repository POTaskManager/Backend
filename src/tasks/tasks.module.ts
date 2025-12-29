import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
