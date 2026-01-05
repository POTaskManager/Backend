<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# TaskManager Backend

NestJS backend for TaskManager - Complete project management system with real-time features.

## 📚 API Documentation

**🌐 Swagger UI (Interactive):** http://localhost:4200/api/docs  
**📄 OpenAPI JSON:** http://localhost:4200/api/docs-json

### Export OpenAPI Documentation
```bash
# Export to docs/openapi.json
npm run export:openapi
```

### Quick Start
```bash
# 1. Start services
docker-compose -f docker-compose.dev.yml up -d

# 2. Open Swagger UI
open http://localhost:4200/api/docs
```

---

## 🚀 Features

- ✅ **69 REST API endpoints** - Fully documented with OpenAPI/Swagger
- ✅ **Multi-database architecture** - Global DB + per-project databases
- ✅ **Real-time features** - WebSocket chat, typing indicators
- ✅ **Invitation system** - Email + dashboard invitations
- ✅ **Notification system** - BullMQ + Redis + Email templates
- ✅ **Google OAuth** - Social login integration
- ✅ **JWT Authentication** - Cookie + Bearer token support
- ✅ **Workflow validation** - Kanban status transitions
- ✅ **Sprint management** - Statistics, burndown tracking
- ✅ **File uploads** - Chat attachments

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start in watch mode
npm run start:dev

# Build for production
npm run build

# Run tests
npm run test
```

## 🐳 Docker

```bash
# Start all services (db, redis, mailhog, backend)
docker-compose -f docker-compose.dev.yml up -d

# View backend logs
docker logs -f potask_backend_dev

# Stop services
docker-compose -f docker-compose.dev.yml down
```

## 🧪 Testing

```bash
# Run API integration tests
npm run test

# Individual test scripts
bash test-api-random.sh          # Full API test suite (53 tests)
bash test-delete-project.sh      # Project deletion tests
bash test-new-features.sh        # Features tests
bash test-dashboard-invitations.sh  # Invitations tests
```

---

## 📦 Tech Stack

- **NestJS** - Backend framework
- **PostgreSQL** - Database (multi-tenant)
- **Drizzle ORM** - Type-safe database access
- **Redis + BullMQ** - Job queue for notifications
- **Socket.io** - WebSocket real-time communication
- **Passport.js** - Authentication (JWT + Google OAuth)
- **Nodemailer** - Email sending
- **Swagger/OpenAPI** - API documentation
- **class-validator** - Request validation

---

## 📋 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/globaldb

# Auth
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email
SMTP_HOST=mailhog
SMTP_PORT=1025
FRONTEND_URL=http://localhost:3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 🏗️ Architecture

### Multi-Database Design
- **Global Database:** Users, projects, roles, invitations
- **Project Databases:** Separate DB per project (tasks, boards, sprints, chat)

### Key Modules
- **Auth** - Login, OAuth, JWT
- **Projects** - CRUD, invitations, members
- **Tasks** - CRUD, workflow, labels, comments
- **Sprints** - Management, statistics
- **Chat** - WebSocket, messages, typing
- **Notifications** - Queue-based email system

---

## 📄 License

[MIT licensed](LICENSE)

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
