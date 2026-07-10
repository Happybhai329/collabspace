/**
 * src/config/database.js
 *
 * MongoDB connection management via Mongoose.
 *
 * WHY this design:
 * - Connection is established once at startup, not on every request
 * - Exponential backoff retry loop prevents crashes on temporary DB unavailability
 * - Connection events are logged for observability
 * - Mongoose options tuned for production (connection pool, timeouts)
 * - Separate disconnect function for graceful shutdown (SIGINT/SIGTERM)
 *
 * Connection Pool: Default 5 connections is usually fine for most workloads.
 * For high-concurrency scenarios, increase `maxPoolSize` and monitor.
 */

import mongoose from 'mongoose';
import config from './env.config.js';
import logger from './logger.js';

const RETRY_DELAY_MS = 5000;  // Wait 5s between retries
const MAX_RETRIES = 5;        // Give up after 5 attempts (Kubernetes will restart the pod)

/**
 * Connects to MongoDB with retry logic.
 * @param {number} attempt - Current attempt number (used internally for recursion)
 */
export async function connectDatabase(attempt = 1) {
  try {
    logger.info(`[DB] Attempting MongoDB connection (attempt ${attempt}/${MAX_RETRIES})...`);

    await mongoose.connect(config.mongo.uri, {
      // ── Connection Pool ─────────────────────────────────────────────────────
      maxPoolSize: 10,        // Max simultaneous connections
      minPoolSize: 2,         // Keep at least 2 connections ready
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      connectTimeoutMS: 10000, // Fail fast if can't connect in 10s
      serverSelectionTimeoutMS: 5000, // Fail atlas selection in 5s
    });

    logger.info(`[DB] ✅ MongoDB connected: ${mongoose.connection.host}`);

  } catch (error) {
    logger.error(`[DB] Connection failed: ${error.message}`);

    if (attempt < MAX_RETRIES) {
      logger.warn(`[DB] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDatabase(attempt + 1);
    }

    logger.error('[DB] ❌ Max retries exceeded. Shutting down.');
    process.exit(1);
  }
}

// ── Connection Event Listeners ────────────────────────────────────────────────
// These fire after initial connection and are critical for observability

mongoose.connection.on('connected', () => {
  logger.info('[DB] Mongoose connected to MongoDB.');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('[DB] Mongoose disconnected from MongoDB.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`[DB] Mongoose error: ${err.message}`);
});

/**
 * Gracefully disconnects from MongoDB.
 * Called during SIGINT/SIGTERM handlers in server.js.
 */
export async function disconnectDatabase() {
  await mongoose.connection.close();
  logger.info('[DB] MongoDB connection closed gracefully.');
}
