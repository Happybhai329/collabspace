/**
 * src/middleware/rateLimiter.middleware.js
 *
 * Rate limiting configuration using express-rate-limit.
 *
 * WHY rate limiting:
 * - Prevents brute-force attacks (most critical for auth endpoints)
 * - Prevents DoS/DDoS from exhausting server resources
 * - Limits API abuse by bots or scraping
 * - Protects MongoDB from query flooding
 *
 * STRATEGY — Multiple tiers:
 * 1. globalLimiter:   100 req / 15min — applies to ALL routes
 * 2. authLimiter:     10 req / 15min — applies to /register and /login only
 * 3. sensitiveOpsLimiter: 5 req / hour — for password reset, email verification
 *
 * WHY more restrictive auth limits:
 * Brute-forcing a password requires thousands of attempts.
 * 10 requests per 15 minutes makes brute force practically impossible
 * while not impacting legitimate users (who rarely fail login 10 times).
 *
 * SKIP IN TEST:
 * Rate limiters are disabled in test environment to avoid flaky test failures.
 *
 * PRODUCTION CONSIDERATION:
 * In a multi-instance deployment, in-memory rate limiting doesn't work —
 * each instance has its own counter. Use redis-rate-limit store with ioredis.
 * We've prepared the config for this upgrade on Day 9.
 */

import rateLimit from 'express-rate-limit';
import config from '../config/env.config.js';

const isTest = config.env === 'test';

/**
 * Standard rate limit response format — matches our API response envelope.
 */
function rateLimitHandler(req, res) {
  return res.status(429).json({
    success: false,
    statusCode: 429,
    message: 'Too many requests. Please slow down and try again later.',
    retryAfter: Math.ceil(res.getHeader('Retry-After')),
  });
}

/**
 * Global rate limiter — all routes.
 * 100 requests per 15 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,  // 15 minutes
  max: isTest ? 999999 : config.rateLimit.max, // Unlimited in test
  standardHeaders: 'draft-7', // Return rate limit info in `RateLimit-*` headers (RFC standard)
  legacyHeaders: false,       // Disable `X-RateLimit-*` headers (deprecated)
  handler: rateLimitHandler,
  skipFailedRequests: false,  // Count failed requests toward the limit
  keyGenerator: (req) => {
    // Use X-Forwarded-For for clients behind proxies (Render, Vercel, Nginx)
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  },
});

/**
 * Strict rate limiter for authentication endpoints.
 * 10 requests per 15 minutes per IP.
 * Applied to: POST /auth/register, POST /auth/login
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 999999 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  },
});

/**
 * Very strict limiter for sensitive operations.
 * 5 requests per hour per IP.
 * Applied to: password reset, email verification, etc.
 */
export const sensitiveOpsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 999999 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  },
});
