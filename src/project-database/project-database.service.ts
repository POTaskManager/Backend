import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma-project/client';

@Injectable()
export class ProjectDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(ProjectDatabaseService.name);
  private readonly connections = new Map<string, PrismaClient>();

  /**
   * Get Prisma client for specific project database
   * @param namespace - Project database namespace (from proj_db_namespace)
   * @returns PrismaClient connected to project_{namespace} database
   */
  async getProjectClient(namespace: string): Promise<PrismaClient> {
    // Return existing connection if available
    if (this.connections.has(namespace)) {
      return this.connections.get(namespace)!;
    }

    // Create new connection (lazy loading)
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'changeme';
    const dbPrefix = process.env.DB_PROJECT_PREFIX || 'project_';
    
    const dbName = `${dbPrefix}${namespace}`;
    const dbUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?schema=public`;
    
    this.logger.log(`Creating new connection to project database: ${dbName}`);
    
    const client = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });

    await client.$connect();
    this.connections.set(namespace, client);
    
    return client;
  }

  /**
   * Graceful shutdown - disconnect all project database connections
   */
  async onModuleDestroy() {
    this.logger.log(`Disconnecting ${this.connections.size} project database connections`);
    
    const disconnectPromises = Array.from(this.connections.values()).map(client =>
      client.$disconnect().catch(err => 
        this.logger.error(`Failed to disconnect client: ${err.message}`)
      )
    );
    
    await Promise.all(disconnectPromises);
    this.connections.clear();
  }

  /**
   * Manually close connection to specific project (useful for cleanup)
   */
  async closeConnection(namespace: string): Promise<void> {
    const client = this.connections.get(namespace);
    if (client) {
      await client.$disconnect();
      this.connections.delete(namespace);
      this.logger.log(`Closed connection to project database: project_${namespace}`);
    }
  }
}
