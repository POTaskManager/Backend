import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BoardsModule } from './boards/boards.module';
import { ChatModule } from './chat/chat.module';
import { CommentsModule } from './comments/comments.module';
import { DrizzleModule } from './drizzle/drizzle.module';
import { LabelsModule } from './labels/labels.module';
import { ProjectsModule } from './projects/projects.module';
import { SprintsModule } from './sprints/sprints.module';
import { StatusesModule } from './statuses/statuses.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),
        GOOGLE_AUTH_REDIRECT: Joi.string().required(),
        REDIS_HOST: Joi.string().default('redis'),
        REDIS_PORT: Joi.number().default(6379),
        SMTP_HOST: Joi.string().default('mailhog'),
        SMTP_PORT: Joi.number().default(1025),
        SMTP_SECURE: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '0', '1')).default(false),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASSWORD: Joi.string().allow('').optional(),
        SMTP_FROM: Joi.string().default('noreply@potask.local'),
        RESEND_API_KEY: Joi.string().allow('').optional(),
        EMAIL_PROVIDER: Joi.string().valid('smtp', 'resend').default('smtp'),
        FRONTEND_URL: Joi.string().default('http://localhost:3000'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'redis'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    DrizzleModule,
    UsersModule,
    ProjectsModule,
    BoardsModule,
    SprintsModule,
    TasksModule,
    LabelsModule,
    CommentsModule,
    ChatModule,
    StatusesModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
