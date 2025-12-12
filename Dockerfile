# Multi-stage build for production

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies first
RUN npm install

# Copy prisma schemas and config
COPY prisma ./prisma
COPY prisma.config.ts ./

# Set dummy DATABASE_URL for prisma generate (not used, just required)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

# Generate both Prisma clients
RUN npx prisma generate --schema=prisma/schema.prisma && \
    npx prisma generate --schema=prisma/project-schema.prisma

# Copy source code
COPY src ./src
COPY nest-cli.json tsconfig.json tsconfig.build.json ./

# Build application (keep dummy DATABASE_URL for prisma:generate in build script)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --production

# Copy Prisma clients from builder (already generated)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/@prisma-project ./node_modules/@prisma-project
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy prisma schemas and config (needed for migrations)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

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
