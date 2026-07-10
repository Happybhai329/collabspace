# ============================================================
# Dockerfile — Backend
# Multi-stage build for minimal production image size
# ============================================================

# ── Stage 1: Dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
# (only re-runs npm install if package.json or package-lock.json changes)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# ── Stage 2: Production Image ──────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S collabspace -u 1001

WORKDIR /app

# Copy only the production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=collabspace:nodejs . .

# Switch to non-root user
USER collabspace

# Expose port (must match PORT env var)
EXPOSE 5000

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start the application
CMD ["node", "server.js"]
