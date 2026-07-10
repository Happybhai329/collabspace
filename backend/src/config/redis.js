/**
 * src/config/redis.js
 *
 * Redis connection via ioredis.
 *
 * WHY ioredis over the official `redis` package:
 * - ioredis has better cluster support (needed when scaling)
 * - Built-in reconnect strategy with more control
 * - Better TypeScript types (future migration path)
 * - Used by Socket.io adapters natively
 *
 * WHY Redis at all:
 * - Refresh token allow-listing / blocklisting (revoking sessions)
 * - Rate limit counters (atomic INCR operations)
 * - Session caching (avoid DB hits on every request)
 * - Socket.io pub/sub adapter (horizontal scaling across multiple Node instances)
 * - Task queue (Bull/BullMQ) for background jobs in later days
 *
 * Connection Strategy:
 * - In development: connect to local Redis
 * - In production: connect via REDIS_URL (Upstash, Railway, ElastiCache)
 */

import Redis from 'ioredis';
import config from './env.config.js';
import logger from './logger.js';

let redisClient = null;

/**
 * Creates and returns a Redis client instance.
 * Uses singleton pattern — only one connection per process.
 */
export function createRedisClient() {
  if (redisClient) return redisClient;

  const connectionOptions = {
    // Reconnect strategy: retry with increasing delay, cap at 3s
    retryStrategy(times) {
      if (times > 10) {
        logger.error('[Redis] ❌ Max reconnection attempts exceeded.');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 300, 3000);
      logger.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    // Suppress the "ready_check" on connect for slightly faster startup
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  };

  // If a full Redis URL is provided (Upstash/Railway), use it directly
  if (config.redis.url) {
    redisClient = new Redis(config.redis.url, connectionOptions);
  } else {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      ...connectionOptions,
    });
  }

  // ── Event Listeners ───────────────────────────────────────────────────────

  redisClient.on('connect', () => {
    logger.info('[Redis] Connecting...');
  });

  redisClient.on('ready', () => {
    logger.info('[Redis] ✅ Connection established and ready.');
  });

  redisClient.on('error', (err) => {
    logger.error(`[Redis] Error: ${err.message}`);
  });

  redisClient.on('close', () => {
    logger.warn('[Redis] Connection closed.');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('[Redis] Reconnecting...');
  });

  return redisClient;
}

/**
 * Returns the existing Redis client.
 * Throws if called before createRedisClient().
 */
export function getRedisClient() {
  if (!redisClient) {
    throw new Error('[Redis] Client not initialized. Call createRedisClient() first.');
  }
  return redisClient;
}

/**
 * Gracefully disconnects from Redis.
 * Called during SIGINT/SIGTERM in server.js.
 */
export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('[Redis] Connection closed gracefully.');
    redisClient = null;
  }
}
