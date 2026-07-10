/**
 * src/config/env.config.js
 *
 * Centralized environment configuration.
 *
 * WHY: Scattering process.env calls throughout the codebase is an anti-pattern.
 * It makes it impossible to know what environment variables the app needs,
 * hides missing variable bugs until runtime, and makes testing harder.
 *
 * This module:
 * 1. Loads .env via dotenv (only once, at startup)
 * 2. Validates that all required variables are present
 * 3. Exports a frozen config object that the entire app imports
 *
 * Trade-off: We could use a validation library like Zod here too,
 * but keeping this pure is intentional — this file loads before anything else.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend root (two levels up from src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Validates that a required environment variable exists.
 * Throws at startup rather than failing silently later.
 */
function requireEnv(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[CONFIG] Missing required environment variable: ${key}. ` +
        `Check your .env file against .env.example.`
    );
  }
  return value.trim();
}

/**
 * Returns an optional env variable with a default fallback.
 */
function optionalEnv(key, defaultValue) {
  return process.env[key]?.trim() || defaultValue;
}

const config = Object.freeze({
  // ── Server ─────────────────────────────────────────────────────────────────
  env: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '5000'), 10),
  apiVersion: optionalEnv('API_VERSION', 'v1'),
  isDev: optionalEnv('NODE_ENV', 'development') === 'development',
  isProd: optionalEnv('NODE_ENV', 'development') === 'production',

  // ── MongoDB ─────────────────────────────────────────────────────────────────
  mongo: {
    uri: requireEnv('MONGO_URI'),
  },

  // ── Redis ───────────────────────────────────────────────────────────────────
  redis: {
    host: optionalEnv('REDIS_HOST', 'localhost'),
    port: parseInt(optionalEnv('REDIS_PORT', '6379'), 10),
    password: optionalEnv('REDIS_PASSWORD', ''),
    // If REDIS_URL is set (Upstash/Railway), it takes precedence
    url: optionalEnv('REDIS_URL', ''),
  },

  // ── JWT ─────────────────────────────────────────────────────────────────────
  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  // ── Cookies ─────────────────────────────────────────────────────────────────
  cookie: {
    domain: optionalEnv('COOKIE_DOMAIN', 'localhost'),
    // Secure cookies MUST be true in production (requires HTTPS)
    secure: optionalEnv('COOKIE_SECURE', 'false') === 'true',
    httpOnly: true,
    sameSite: 'lax',
  },

  // ── CORS ────────────────────────────────────────────────────────────────────
  cors: {
    origins: optionalEnv('CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
  },

  // ── Rate Limiting ────────────────────────────────────────────────────────────
  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optionalEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },

  // ── Bcrypt ──────────────────────────────────────────────────────────────────
  bcrypt: {
    // 12 rounds = ~250ms on modern hardware. Good balance of security vs UX.
    // Never go below 10. Consider 14+ for high-security accounts.
    saltRounds: parseInt(optionalEnv('BCRYPT_SALT_ROUNDS', '12'), 10),
  },

  // ── Logging ─────────────────────────────────────────────────────────────────
  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
  },
});

export default config;
