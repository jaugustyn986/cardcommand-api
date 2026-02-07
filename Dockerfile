# ============================================
# CardCommand Center API - Dockerfile
# ============================================

# Build stage
FROM node:18-alpine AS builder

# Install OpenSSL and other required libraries for Prisma
RUN apk add --no-cache openssl libssl3

WORKDIR /app

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install OpenSSL and other required libraries for Prisma
RUN apk add --no-cache openssl libssl3 dumb-init

WORKDIR /app

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm install --production

# Generate Prisma client for production
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Run migrations (will use DATABASE_URL env var at runtime)
# We'll do this in start.sh instead

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application with migrations
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
