import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as projectSchema from './schemas/project.schema';
import * as globalSchema from './schemas/global.schema';

/**
 * DRIZZLE DATABASE SERVICE
 * Manages global DB and multi-tenant project DBs
 * Implements OnModuleDestroy for graceful shutdown
 */

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);

  // Global database connection
  private globalDb: NodePgDatabase<typeof globalSchema>;
  private globalPool: Pool;

  // Multi-tenant project database connections (cached)
  private projectConnections = new Map<
    string,
    NodePgDatabase<typeof projectSchema>
  >();
  private projectPools = new Map<string, Pool>();

  constructor(private configService: ConfigService) {}

  /**
   * Initialize global database connection
   */
  async initializeGlobalDb() {
    try {
      const dbHost = this.configService.get<string>('DB_HOST') || 'db';
      const dbPort = this.configService.get<number>('DB_PORT') || 5432;
      const dbUser = this.configService.get<string>('DB_USER') || 'postgres';
      const dbPassword =
        this.configService.get<string>('DB_PASSWORD') || 'changeme';
      const dbName = this.configService.get<string>('DB_NAME') || 'taskmanager';

      this.globalPool = new Pool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        // Connection pool configuration (node-postgres best practices)
        max: 20, // Maximum number of clients in the pool
        min: 2, // Minimum number of clients to keep in pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return error after 2 seconds if no connection available
      });

      // Error handler for idle clients (prevents app crash on backend errors)
      this.globalPool.on('error', (err, client) => {
        this.logger.error(
          'Unexpected error on idle client in global pool',
          err,
        );
      });

      this.globalDb = drizzle(this.globalPool, { schema: globalSchema });

      // Test connection
      await this.globalPool.query('SELECT NOW()');
      this.logger.log(`✓ Connected to global database: ${dbName}`);

      return this.globalDb;
    } catch (error) {
      this.logger.error(
        `Failed to initialize global database: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get global database connection
   */
  getGlobalDb(): NodePgDatabase<typeof globalSchema> {
    if (!this.globalDb) {
      throw new Error(
        'Global database not initialized. Call initializeGlobalDb() first.',
      );
    }
    return this.globalDb;
  }

  /**
   * Get or create project-specific database connection
   */
  async getProjectDb(
    namespace: string,
  ): Promise<NodePgDatabase<typeof projectSchema>> {
    // Return cached connection if available
    if (this.projectConnections.has(namespace)) {
      return this.projectConnections.get(namespace)!;
    }

    try {
      const dbHost = this.configService.get<string>('DB_HOST') || 'db';
      const dbPort = this.configService.get<number>('DB_PORT') || 5432;
      const dbUser = this.configService.get<string>('DB_USER') || 'postgres';
      const dbPassword =
        this.configService.get<string>('DB_PASSWORD') || 'changeme';
      const dbName = `project_${namespace}`;

      const pool = new Pool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        // Connection pool configuration (node-postgres best practices)
        max: 10, // Smaller pool per project (multi-tenant)
        min: 1, // Keep at least 1 connection warm
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return error after 2 seconds
      });

      // Error handler for idle clients
      pool.on('error', (err, client) => {
        this.logger.error(
          `Unexpected error on idle client in project pool ${dbName}`,
          err,
        );
      });

      // Test connection
      await pool.query('SELECT NOW()');

      const db = drizzle(pool, { schema: projectSchema });

      // Cache for reuse
      this.projectConnections.set(namespace, db);
      this.projectPools.set(namespace, pool);

      this.logger.log(`✓ Connected to project database: ${dbName}`);
      return db;
    } catch (error) {
      this.logger.error(
        `Failed to connect to project database ${namespace}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Create new project database and initialize schema
   */
  async createProjectDatabase(namespace: string): Promise<void> {
    const dbName = `project_${namespace}`;

    try {
      this.logger.log(`Creating project database: ${dbName}`);

      // Step 1: Create database using global connection
      const adminPool = this.globalPool || (await this.createAdminConnection());
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      this.logger.log(`✓ Database created: ${dbName}`);

      // Step 2: Connect to new database temporarily
      const tempDb = await this.createTempConnection(dbName);

      // Step 3: Load schema from projectdb.sql
      this.logger.log(`Loading schema into ${dbName}`);
      await this.loadProjectSchema(tempDb, dbName);

      // Close and reopen connection to ensure fresh state
      await tempDb.end();
      const seedDb = await this.createTempConnection(dbName);

      // Step 4: Load seed data from seed-project-data.sql
      this.logger.log(`Seeding data for ${dbName}`);
      await this.seedProjectDatabase(seedDb, dbName);

      // Close seed connection
      await seedDb.end();
      this.logger.log(`✓ Project database initialized successfully: ${dbName}`);
    } catch (error) {
      this.logger.error(`Failed to create project database: ${error.message}`);
      // Try to clean up
      try {
        await this.globalPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
      } catch (cleanupError) {
        this.logger.error(`Cleanup failed: ${cleanupError.message}`);
      }
      throw error;
    }
  }

  /**
   * Create temporary connection to new database
   */
  private async createTempConnection(dbName: string): Promise<Pool> {
    const dbHost = this.configService.get<string>('DB_HOST') || 'db';
    const dbPort = this.configService.get<number>('DB_PORT') || 5432;
    const dbUser = this.configService.get<string>('DB_USER') || 'postgres';
    const dbPassword =
      this.configService.get<string>('DB_PASSWORD') || 'changeme';

    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      // Temporary connection - minimal pool
      max: 2,
      min: 0,
      idleTimeoutMillis: 10000,
    });

    try {
      await pool.query('SELECT NOW()');
      return pool;
    } catch (error) {
      await pool.end();
      return pool;
    }
  }

  /**
   * Create admin connection to system database
   */
  private async createAdminConnection(): Promise<Pool> {
    const dbHost = this.configService.get<string>('DB_HOST') || 'db';
    const dbPort = this.configService.get<number>('DB_PORT') || 5432;
    const dbUser = this.configService.get<string>('DB_USER') || 'postgres';
    const dbPassword =
      this.configService.get<string>('DB_PASSWORD') || 'changeme';

    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      // Admin connection - minimal pool
      max: 2,
      min: 0,
      database: 'postgres',
    });

    try {
      await pool.query('SELECT NOW()');
      return pool;
    } catch (error) {
      await pool.end();
      throw new Error(`Failed to create admin connection: ${error.message}`);
    }
  }

  /**
   * Load schema SQL statements into database
   */
  private async loadProjectSchema(pool: Pool, dbName: string): Promise<void> {
    try {
      const schemaPath = join(__dirname, '../../database/db/projectdb.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');

      const statements = this.parseSqlStatements(schemaSql);
      this.logger.log(
        `Executing ${statements.length} schema statements for ${dbName}`,
      );

      let successCount = 0;
      for (let i = 0; i < statements.length; i++) {
        try {
          await pool.query(statements[i]);
          successCount++;
        } catch (err) {
          const errMsg = err.message || '';
          // Only skip "already exists" type errors
          if (
            errMsg.includes('already exists') ||
            errMsg.includes('duplicate')
          ) {
            this.logger.debug(
              `Skipped (already exists): ${statements[i].substring(0, 50)}...`,
            );
            successCount++;
          } else {
            this.logger.error(
              `Failed to execute statement ${i + 1}/${statements.length}: ${errMsg}`,
            );
            this.logger.error(
              `Full statement: ${statements[i].substring(0, 200)}...`,
            );
            throw err;
          }
        }
      }
      this.logger.log(
        `✓ Schema loaded: ${successCount}/${statements.length} statements`,
      );
    } catch (error) {
      throw new Error(`Failed to load schema: ${error.message}`);
    }
  }

  /**
   * Seed database with initial data
   */
  private async seedProjectDatabase(pool: Pool, dbName: string): Promise<void> {
    try {
      // Verify schema is loaded by checking for a key table
      try {
        await pool.query(`SELECT 1
                          FROM statustypes
                          LIMIT 1`);
        this.logger.debug('Schema verification: statustypes table exists');
      } catch (verifyErr) {
        this.logger.error(`Schema verification failed: ${verifyErr.message}`);
        // Try to check what tables do exist
        const tables = await pool.query(`
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY tablename
        `);
        this.logger.error(
          `Available tables: ${tables.rows.map((r) => r.tablename).join(', ')}`,
        );
        throw new Error('Schema not properly loaded before seeding');
      }

      const seedPath = join(
        __dirname,
        '../../database/db/seed-project-data.sql',
      );
      const seedSql = readFileSync(seedPath, 'utf8');

      const statements = this.parseSqlStatements(seedSql);
      this.logger.log(
        `Executing ${statements.length} seed statements for ${dbName}`,
      );

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];

        try {
          const result = await pool.query(stmt);
        } catch (err) {
          const errMsg = err.message || '';
          if (!errMsg.includes('duplicate key')) {
            this.logger.error(
              `Seed statement ${i + 1}/${statements.length} failed: ${errMsg}`,
            );
            this.logger.error(
              `Full statement (length ${stmt.length}): ${stmt}`,
            );
            throw err;
          }
        }
      }
      this.logger.log(`✓ Seed data loaded: ${statements.length} statements`);
    } catch (error) {
      this.logger.warn(`Seed data loading had issues: ${error.message}`);
      // Don't throw - partial seed is OK
    }
  }

  /**
   * Parse SQL file into individual statements
   * Handles multi-line statements and comments correctly
   */
  private parseSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    let i = 0;

    while (i < sql.length) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      // Handle string literals
      if ((char === '"' || char === "'") && sql[i - 1] !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        currentStatement += char;
        i++;
        continue;
      }

      // Handle line comments when not in a string
      if (!inString && char === '-' && nextChar === '-') {
        // Skip to end of line
        while (i < sql.length && sql[i] !== '\n') {
          i++;
        }
        // Don't skip the newline - let it be processed normally
        continue;
      }

      // Handle block comments when not in a string
      if (!inString && char === '/' && nextChar === '*') {
        // Skip to end of block comment
        i += 2;
        while (i < sql.length - 1) {
          if (sql[i] === '*' && sql[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }

      // Handle statement terminator (semicolon)
      if (char === ';' && !inString) {
        currentStatement += char;
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        currentStatement = '';
        i++;
        continue;
      }

      // Add character to current statement
      currentStatement += char;
      i++;
    }

    // Add final statement if exists
    const trimmed = currentStatement.trim();
    if (trimmed.length > 0) {
      statements.push(trimmed);
    }

    return statements;
  }

  /**
   * NestJS lifecycle hook - cleanup on shutdown
   */
  async onModuleDestroy() {
    this.logger.log('Shutting down DrizzleService...');
    await this.closeAll();
  }

  /**
   * Close all connections (cleanup)
   */
  async closeAll() {
    try {
      // Close global connection
      if (this.globalPool) {
        await this.globalPool.end();
        this.logger.log('✓ Closed global database connection');
      }

      // Close all project connections
      for (const [namespace, pool] of this.projectPools) {
        await pool.end();
        this.logger.log(`✓ Closed project database connection: ${namespace}`);
      }

      this.projectConnections.clear();
      this.projectPools.clear();
    } catch (error) {
      this.logger.error(`Error closing connections: ${error.message}`);
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      globalConnected: !!this.globalDb,
      projectConnections: this.projectConnections.size,
      projects: Array.from(this.projectConnections.keys()),
    };
  }
}
