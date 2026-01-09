import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  getApiInfo() {
    return {
      name: 'TaskManager API',
      version: '1.0.0',
      description: 'Complete Project Management System with Kanban boards, Sprints, and Real-time Chat',
      documentation: '/api/docs',
      health: '/api/health',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        projects: '/api/projects',
        tasks: '/api/projects/:projectId/tasks',
        sprints: '/api/projects/:projectId/sprints',
        boards: '/api/projects/:projectId/boards',
        chat: '/api/projects/:projectId/chats',
        notifications: '/api/notifications',
      },
      features: [
        'JWT Authentication with OAuth2 (Google)',
        'Multi-tenant project databases',
        'Kanban boards with drag & drop',
        'Sprint management',
        'Real-time WebSocket chat',
        'Task comments and labels',
        'Email notifications (MailHog in dev)',
        'Activity audit logs',
      ],
      tech: {
        framework: 'NestJS',
        database: 'PostgreSQL 18',
        orm: 'Drizzle ORM',
        cache: 'Redis',
        queue: 'Bull Queue',
      },
    };
  }

  @Public()
  @Get('health')
  @ApiTags('health')
  @ApiOperation({ 
    summary: 'Health check endpoint',
    description: 'Simple health check endpoint for monitoring service availability. Returns OK status with current timestamp. Used by load balancers, Kubernetes probes, and monitoring tools to verify the service is running and responsive.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy and operational',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
