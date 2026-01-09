import { Module, forwardRef } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LabelsModule } from '../labels/labels.module';

@Module({
  imports: [
    DrizzleModule, 
    NotificationsModule,
    forwardRef(() => LabelsModule),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
