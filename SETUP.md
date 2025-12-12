# Backend Setup Instructions

## Prerequisites
- Node.js >= 18
- PostgreSQL database accessible (local or Docker)
- npm or yarn

## Local Development Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env` and update values:
```bash
cp .env.example .env
```

**Important:** Update these values in `.env`:
- `DATABASE_URL` - Your global database connection string
- `PROJECT_DATABASE_URL` - Template for project databases (used by Prisma CLI)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` - Database connection details
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - Generate using `openssl rand -base64 32`
- `OAUTH_ENCRYPTION_KEY` - Must be at least 32 characters

### 3. Generate Prisma Clients
**CRITICAL STEP** - Must be done before build/run:
```bash
# Generate global database client
npx prisma generate --schema=prisma/schema.prisma

# Generate project database client
npx prisma generate --schema=prisma/project-schema.prisma
```

### 4. Run migrations (if needed)
```bash
# For global database
npx prisma migrate deploy --schema=prisma/schema.prisma

# For project databases (run for each project database)
npx prisma migrate deploy --schema=prisma/project-schema.prisma
```

### 5. Build the application
```bash
npm run build
```

### 6. Run the application
```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod
```

## Docker Development Setup

### Using external PostgreSQL container

If you have PostgreSQL running in a separate Docker container (e.g., `potask_db`):

```bash
# Build and start the backend
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop the backend
docker-compose -f docker-compose.dev.yml down
```

**Note:** The docker-compose.dev.yml assumes:
- PostgreSQL container is in network `database_default`
- Database is accessible via hostname `db`
- Update environment variables in docker-compose.dev.yml if your setup differs

## Troubleshooting

### Error: Cannot find module '@prisma-project/client'
**Solution:** You forgot to generate Prisma clients (Step 3). Run:
```bash
npx prisma generate --schema=prisma/schema.prisma
npx prisma generate --schema=prisma/project-schema.prisma
```

### Error: Port 4200 already in use
**Solution:** Kill the process using port 4200:
```bash
# Linux/Mac
fuser -k 4200/tcp

# Or change PORT in .env file
```

### Database connection errors
**Solution:** Verify database is running and credentials are correct:
```bash
# Test connection
docker exec potask_db psql -U postgres -d globaldb -c "\l"
```

### Fresh setup after pulling changes
```bash
# Clean install
rm -rf node_modules package-lock.json dist
npm install
npx prisma generate --schema=prisma/schema.prisma
npx prisma generate --schema=prisma/project-schema.prisma
npm run build
```

## Project Structure

- **globaldb** - Contains: users, projects, projectaccess, oauthaccounts
- **project_xxx** - Each project has its own database with: sprints, tasks, boards, columns, statuses, etc.

The application dynamically connects to project databases based on `proj_db_namespace` stored in globaldb.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | Global database connection (runtime) |
| PROJECT_DATABASE_URL | Yes | Template for Prisma CLI (not used in runtime) |
| DB_HOST | Yes | Database host for dynamic connections |
| DB_PORT | Yes | Database port |
| DB_USER | Yes | Database user |
| DB_PASSWORD | Yes | Database password |
| DB_PROJECT_PREFIX | Yes | Prefix for project databases (default: `project_`) |
| PORT | Yes | Server port (default: 4200) |
| JWT_SECRET | Yes | Secret for JWT tokens |
| JWT_REFRESH_SECRET | Yes | Secret for refresh tokens |
| OAUTH_ENCRYPTION_KEY | Yes | Key for encrypting OAuth data (min 32 chars) |
| GOOGLE_CLIENT_ID | No | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | No | Google OAuth client secret |
| GOOGLE_CALLBACK_URL | No | OAuth callback URL |
| GOOGLE_AUTH_REDIRECT | No | Frontend redirect after OAuth |
| NODE_ENV | No | Environment (development/production) |
