# Multi-stage build for production

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies first
RUN npm install

# Copy prisma schemas
COPY prisma ./prisma

# Set dummy DATABASE_URL for prisma generate (not used, just required by config)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma clients
RUN npx prisma generate --schema=prisma/schema.prisma && \
    npx prisma generate --schema=prisma/project-schema.prisma

# Copy source code
COPY src ./src
COPY nest-cli.json tsconfig.json tsconfig.build.json ./

# Build application (keep DATABASE_URL for build script)
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --production

# Copy prisma schemas for runtime
COPY prisma ./prisma

# Generate Prisma clients in production image
RUN npx prisma generate --schema=prisma/schema.prisma && \
    npx prisma generate --schema=prisma/project-schema.prisma

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads && chown -R node:node uploads

# Switch to non-root user
USER node

# Expose port
EXPOSE 4200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4200/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/main.js"]
