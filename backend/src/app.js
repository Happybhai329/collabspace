/**
 * src/app.js
 *
 * Express application factory.
 *
 * WHY a factory function instead of a module-level app instance:
 * - Enables creating multiple app instances (one per test file) without port conflicts
 * - Separates app configuration from server startup (server.js handles that)
 * - Makes the app purely about HTTP logic, not about I/O (ports, DB connections)
 *
 * MIDDLEWARE ORDER MATTERS (Security middleware must come first):
 * 1. Security headers (Helmet)
 * 2. CORS
 * 3. Request parsing (body-parser)
 * 4. Cookie parsing
 * 5. Input sanitization
 * 6. HTTP parameter pollution protection
 * 7. Request logging
 * 8. Compression
 * 9. Rate limiting
 * 10. Routes
 * 11. 404 handler
 * 12. Global error handler (MUST BE LAST)
 *
 * SECURITY MIDDLEWARE EXPLAINED:
 * - Helmet: Sets 14 security-related HTTP response headers (CSP, HSTS, X-Frame-Options, etc.)
 * - CORS: Controls which origins can make cross-origin requests. Critical for browser security.
 * - mongoSanitize: Strips $ and . from inputs. Prevents NoSQL injection attacks.
 * - hpp: Prevents HTTP parameter pollution (duplicate query params trick).
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

import config from './config/env.config.js';
import logger from './config/logger.js';
import { globalLimiter } from './middleware/rateLimiter.middleware.js';
import { globalErrorHandler } from './middleware/errorHandler.middleware.js';
import { ApiError } from './utils/ApiError.js';

// ── Route Imports ─────────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes.js';

/**
 * Creates and configures the Express application.
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();

  // ── Trust Proxy ──────────────────────────────────────────────────────────
  // Required for correct IP detection when behind Nginx/Render/Vercel proxy
  // '1' means trust the first proxy hop
  app.set('trust proxy', 1);

  // ── Security: Helmet ─────────────────────────────────────────────────────
  // Sets security headers. In development, use relaxed CSP to allow Vite HMR.
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd
        ? undefined  // Use helmet's default strict CSP in production
        : false,     // Disable CSP in development (Vite injects inline scripts)
      crossOriginEmbedderPolicy: false, // Allow embedding (needed for some integrations)
    })
  );

  // ── Security: CORS ───────────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (Postman, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (config.cors.origins.includes(origin)) {
          return callback(null, true);
        }
        return callback(
          new Error(`CORS policy: Origin '${origin}' is not allowed.`)
        );
      },
      credentials: true,    // Allow cookies to be sent cross-origin
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    })
  );

  // ── Body Parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' })); // JSON body limit
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Cookie Parsing ───────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Security: Input Sanitization ─────────────────────────────────────────
  // Removes keys starting with '$' or containing '.' from req.body, req.query, req.params
  // Prevents MongoDB query operator injection attacks
  app.use(
    mongoSanitize({
      replaceWith: '_', // Replace sanitized characters with underscore (prevents stripping valid data)
      onSanitize: ({ req, key }) => {
        logger.warn(`[Security] Potential NoSQL injection attempt detected. Key: ${key}, IP: ${req.ip}`);
      },
    })
  );

  // ── Security: HTTP Parameter Pollution Protection ─────────────────────────
  // Prevents attacks that duplicate query parameters (e.g., ?sort=name&sort=malicious)
  app.use(hpp());

  // ── Response Compression ─────────────────────────────────────────────────
  // Compresses responses larger than ~1KB using gzip
  // Reduces bandwidth usage significantly for list responses
  app.use(compression());

  // ── HTTP Request Logging ─────────────────────────────────────────────────
  if (config.isDev) {
    // Colorized, human-readable logs in development
    app.use(morgan('dev'));
  } else {
    // Structured JSON logs in production (piped to Winston)
    app.use(
      morgan('combined', {
        stream: { write: (message) => logger.http(message.trim()) },
        skip: (req) => req.path === '/health', // Don't log health checks
      })
    );
  }

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  app.use(globalLimiter);

  // ── Health Check ─────────────────────────────────────────────────────────
  // Simple endpoint for load balancers and uptime monitors
  // Returns 200 immediately without hitting DB or Redis
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // ── API Routes ────────────────────────────────────────────────────────────
  const API_PREFIX = `/api/${config.apiVersion}`;

  app.use(`${API_PREFIX}/auth`, authRoutes);

  // Placeholder for future routes (Day 2+)
  // app.use(`${API_PREFIX}/workspaces`, workspaceRoutes);
  // app.use(`${API_PREFIX}/projects`, projectRoutes);
  // app.use(`${API_PREFIX}/boards`, boardRoutes);
  // app.use(`${API_PREFIX}/tasks`, taskRoutes);
  // app.use(`${API_PREFIX}/users`, userRoutes);

  // ── 404 Handler ───────────────────────────────────────────────────────────
  // Catches all requests that didn't match any route
  app.use((req, res, next) => {
    next(ApiError.notFound(`Route ${req.method} ${req.path} not found.`));
  });

  // ── Global Error Handler ──────────────────────────────────────────────────
  // MUST be registered after all routes. 4-parameter signature tells Express it's an error handler.
  app.use(globalErrorHandler);

  return app;
}
