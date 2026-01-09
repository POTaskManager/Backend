import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DrizzleService } from './drizzle/drizzle.service';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  
  // Initialize Drizzle database service
  const drizzleService = app.get(DrizzleService);
  await drizzleService.initializeGlobalDb();

  
  const apiUrl = process.env.API_URL ? process.env.API_URL : "http://localhost:4200"
  
  // Configure CORS based on environment
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : '*';
  
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('TaskManager API')
    .setDescription('Complete API documentation for TaskManager - Project Management System')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    })
    .addTag('health', 'System health - Health check endpoints for monitoring service availability and operational status')
    .addTag('auth', 'Authentication and authorization - User login, logout, registration, OAuth2 Google integration, JWT token management, and session handling')
    .addTag('projects', 'Project management - Create, read, update, delete projects, manage project members, assign roles (owner/admin/member/viewer), and view activity history')
    .addTag('invitations', 'Project invitations - Send email invitations to users, manage pending invitations, accept/reject membership requests')
    .addTag('boards', 'Kanban boards - Create and manage Kanban boards for projects, customize columns, and configure board settings')
    .addTag('tasks', 'Task management - Complete CRUD operations for tasks, assign contributors, change status (drag & drop), manage task lifecycle within sprints')
    .addTag('sprints', 'Sprint management - Create, start, and complete sprints, track sprint statistics, manage task assignments, and view sprint analytics')
    .addTag('statuses', 'Task statuses - Manage task statuses (TODO, In Progress, Done, etc.), configure status columns for Kanban boards, and track status transitions')
    .addTag('labels', 'Task labels - Create and assign labels to tasks (Bug, Feature, Enhancement, etc.), manage label assignments, and organize tasks by categories')
    .addTag('comments', 'Task comments - Add, edit, and delete comments on tasks, collaborate with team members, and track comment history')
    .addTag('chat', 'Project chat - Real-time WebSocket-based chat for project collaboration, send messages, upload files, and track read status')
    .addTag('notifications', 'Notifications - Manage user notification preferences (email, in-app), configure notification settings for different event types')
    .addServer('http://localhost:4200', 'Development server')
    .addTag('auth', 'Authentication endpoints (login, logout, Google OAuth)')
    .addTag('users', 'User management')
    .addTag('projects', 'Project CRUD operations')
    .addTag('invitations', 'Project invitations and membership')
    .addTag('boards', 'Kanban boards management')
    .addTag('tasks', 'Task CRUD and updates')
    .addTag('sprints', 'Sprint management and statistics')
    .addTag('statuses', 'Task statuses and columns')
    .addTag('labels', 'Task labels and assignments')
    .addTag('comments', 'Task comments')
    .addTag('chat', 'Project chat and WebSocket')
    .addTag('notifications', 'Notification system')
    .addServer(`${apiUrl}`, 'Development server')
    .addServer('https://api.taskmanager.example.com', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'TaskManager API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  await app.listen(process.env.PORT ?? 4200);
}
bootstrap();
