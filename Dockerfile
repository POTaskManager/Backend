# Multi-stage build for production

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies first
RUN npm install

# Copy source code
COPY src ./src
COPY nest-cli.json tsconfig.json tsconfig.build.json ./

# Build application
RUN npm run build

# Include email templates in the build output
RUN mkdir -p dist/notifications/templates \
  && cp -R src/notifications/templates/* dist/notifications/templates/

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --production

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
