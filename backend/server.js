/**
 * server.js
 *
 * Application entry point — the ONLY file responsible for:
 * 1. Creating the Express app
 * 2. Connecting to all external services (MongoDB, Redis)
 * 3. Starting the HTTP server
 * 4. Handling graceful shutdown (SIGTERM, SIGINT)
 *
 * WHY separate server.js from app.js:
 * - app.js (pure HTTP logic) can be imported in tests without starting a server
 * - server.js handles I/O concerns (ports, connections) that tests don't need
 * - Graceful shutdown logic belongs here, not in the application logic
 *
 * GRACEFUL SHUTDOWN:
 * When Kubernetes (or Docker/Render) wants to stop the container:
 * 1. It sends SIGTERM
 * 2. We stop accepting new connections (server.close)
 * 3. We wait for in-flight requests to complete
 * 4. We close DB and Redis connections cleanly
 * 5. Process exits with code 0 (success)
 *
 * WHY graceful shutdown matters:
 * Without it, an abrupt process.exit() would:
 * - Drop in-flight HTTP requests (bad UX)
 * - Leave MongoDB transactions uncommitted (data corruption risk)
 * - Leave Redis connections in a broken state
 */

import { createServer } from 'http';
import { createApp } from './src/app.js';
import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { createRedisClient, disconnectRedis } from './src/config/redis.js';
import config from './src/config/env.config.js';
import logger from './src/config/logger.js';

// ── Startup Sequence ──────────────────────────────────────────────────────────

async function startServer() {
  try {
    logger.info(`[Server] Starting CollabSpace API in ${config.env} mode...`);

    // 1. Connect to MongoDB (with retry)
    await connectDatabase();

    // 2. Connect to Redis
    createRedisClient();
    // Note: Redis uses event-based readiness, so we don't await here.
    // The createRedisClient() call initiates the connection.

    // 3. Create Express app (after connections are ready)
    const app = createApp();

    // 4. Create HTTP server (required for Socket.io in Day 4)
    const httpServer = createServer(app);

    // 5. Start listening
    httpServer.listen(config.port, () => {
      logger.info(`[Server] ✅ HTTP server running on port ${config.port}`);
      logger.info(`[Server] API available at http://localhost:${config.port}/api/${config.apiVersion}`);
      logger.info(`[Server] Health check at http://localhost:${config.port}/health`);
    });

    // ── Graceful Shutdown ─────────────────────────────────────────────────
    // Keep a reference to the server for graceful shutdown
    setupGracefulShutdown(httpServer);

    return httpServer;
  } catch (error) {
    logger.error(`[Server] ❌ Failed to start: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

/**
 * Sets up handlers for process termination signals.
 * @param {import('http').Server} httpServer
 */
function setupGracefulShutdown(httpServer) {
  let isShuttingDown = false;

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[Server] ${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    httpServer.close(async () => {
      logger.info('[Server] HTTP server closed. No longer accepting connections.');

      try {
        // Close database connections
        await disconnectDatabase();
        await disconnectRedis();

        logger.info('[Server] All connections closed. Exiting cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error(`[Server] Error during shutdown: ${err.message}`);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds if graceful shutdown takes too long
    // (e.g., stuck requests that never complete)
    setTimeout(() => {
      logger.error('[Server] Graceful shutdown timed out after 30s. Forcing exit.');
      process.exit(1);
    }, 30000);
  }

  // Docker and Kubernetes send SIGTERM
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // Ctrl+C in terminal sends SIGINT
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ── Unhandled Rejection / Exception Handlers ────────────────────────────
  // Last resort: log and exit. Winston's rejectionHandlers already log these,
  // but we want to ensure process exit on unhandled programmer errors.
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`[Server] Unhandled Promise Rejection at: ${promise}, reason: ${reason}`);
    // In production, exit and let the process manager (PM2/Kubernetes) restart
    if (config.isProd) process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error(`[Server] Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
    // Always exit on uncaught exceptions — the process is in an unknown state
    process.exit(1);
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
startServer();
