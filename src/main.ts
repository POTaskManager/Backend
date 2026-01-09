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
