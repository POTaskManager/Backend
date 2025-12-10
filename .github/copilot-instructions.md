# BAckend-DB Project Context

## Project Overview
NestJS backend application with Google OAuth authentication, PostgreSQL database, and Prisma ORM.

## Tech Stack
- **Framework**: NestJS 11.0.1
- **Language**: TypeScript 5.7.3
- **Database**: PostgreSQL 18 (Docker container `potask_db`)
- **ORM**: Prisma 6.19.0
- **Authentication**: Google OAuth + JWT
- **Port**: 3000

## Database Schema
- **Database name**: `appdb`
- **21 tables**: users, tasks, projects, columns (not boards!), statuses, sprints, labels, etc.
- **Naming convention**: lowercase with underscores (e.g., `user_userid`, `task_taskid`, `proj_projid`)
- **Important**: 
  - No `boards` table - use `columns` instead
  - `projectaccess` table for members (not `ProjectMembers`)
  - `sessions` table for refresh tokens (not in users table)

## Project Setup (CRITICAL - READ BEFORE STARTING)

### 1. Database Setup
**IMPORTANT**: This project requires PostgreSQL database from the `Database/` folder in the repository root.

```bash
# Check if database container exists
docker ps | grep potask_db

# If container doesn't exist, create it from Database folder:
cd ../Database
docker-compose up -d

# Verify it's running
docker ps | grep potask_db
# Should show: potask_db container on port 5432
```

**Database details**:
- Container: `potask_db`
- Image: `postgres:18`
- Port: `5432`
- Database: `appdb`
- User: `postgres`
- Password: `changeme`
- Scripts: `Database/db/globaldb.sql` and `Database/db/projectdb.sql`

### 2. Environment Variables
```bash
# Copy template
cp .env.example .env

# Fill in the following:
# - DATABASE_URL: postgresql://postgres:changeme@localhost:5432/appdb?schema=public
# - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: Ask team members for credentials
# - JWT_SECRET and JWT_REFRESH_SECRET: Generate with: openssl rand -base64 32
# - OAUTH_ENCRYPTION_KEY: Min 32 characters
```

**IMPORTANT**: Google OAuth credentials (client_id, client_secret) are shared via team communication channels. Ask team members for the current credentials.

### 3. Prisma Setup
```bash
# Introspect database to generate schema
npx prisma db pull

# Generate Prisma Client
npx prisma generate
```

### 4. Install Dependencies & Run
```bash
npm install
npm run start:dev  # Runs on port 3000
```

## Common Issues & Solutions

### Schema Mismatch Errors
If you see TypeScript errors about field names:
- **Problem**: Old code using PascalCase fields (e.g., `user_FirstName`)
- **Solution**: Use lowercase with underscores (e.g., `user_name`)
- **Fix**: Run `npx prisma db pull` to get latest schema

### Field Name Patterns
- Users: `user_userid`, `user_name`, `user_email`, `user_password_hash`
- Tasks: `task_taskid`, `task_columnid` (NOT `task_boardid`), `task_created_by`
- Projects: `proj_projid`, `proj_name`, `proj_db_namespace`, `proj_created_by`
- Sprints: `spr_sprintid`, `spr_name`, `spr_start_date`, `spr_end_date`
- Columns: `col_columnid`, `col_name`, `col_order`

### Missing Tables
- **boards** doesn't exist → use **columns**
- **ProjectMembers** doesn't exist → use **projectaccess**

## API Endpoints
- Base URL: `http://localhost:3000/api`
- Google OAuth: `/api/auth/google/login`
- Callback: `/api/auth/google/callback`

## Database Architecture (IMPORTANT)

### Current State: **PARTIALLY IMPLEMENTED** ✅

**Architecture Design**:
1. **Global Database** (`globaldb`) - **IMPLEMENTED** ✅:
   - Contains: `users`, `projects`, `projectaccess`, `roles`, `sessions`, `user_identities`, `usersettings`
   - Table `projects` has field `proj_db_namespace` - stores the name/namespace for project database
   - Connection: `DATABASE_URL=postgresql://postgres:changeme@localhost:5432/globaldb`
   - Prisma schema points to global database
   - Available services: Users, Projects, Auth

2. **Project Databases** (`project_*`) - **NOT IMPLEMENTED** ❌:
   - Template: `Database/db/projectdb.sql`
   - Contains: `tasks`, `columns`, `sprints`, `statuses`, `labels`, `comments`, `files`, etc.
   - Should be created **dynamically** for each new project
   - Each project should have its own isolated database (e.g., `project_abc123`)
   - Database name stored in `projects.proj_db_namespace`

**What Works** ✅:
- Global database properly separated
- Backend connects to `globaldb`
- User authentication and project metadata management
- `proj_db_namespace` field available for future use

**Active Modules** (multi-tenant architecture):
- `TasksModule` - routes: `/projects/:projectId/tasks`
- `SprintsModule` - routes: `/projects/:projectId/sprints`
- `BoardsModule` - routes: `/projects/:projectId/boards`
- `ProjectDatabaseModule` - connection pool for project databases

## Development Notes
- Always run `npx prisma generate` after schema changes
- For project databases: `npx prisma generate --schema=prisma/project-schema.prisma`
- Check `.env.example` for required environment variables
- Two Prisma clients: `@prisma/client` (globaldb) and `@prisma-project/client` (project databases)
- **Multi-database architecture implemented** (Dec 2024) - each project has isolated database

## Code Standards
- **Logger messages**: Professional, descriptive, without emojis or informal language
- **Error handling**: Use descriptive error messages with proper context
- **Naming**: Follow existing conventions (lowercase_underscore for database fields)
- **Comments**: Clear, concise, explain "why" not "what"
