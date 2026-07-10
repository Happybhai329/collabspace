/**
 * src/middleware/auth.middleware.js
 *
 * JWT authentication and role-based authorization middleware.
 *
 * AUTHENTICATION vs AUTHORIZATION:
 * - Authentication (verifyToken): "Who are you?" → Verifies the JWT signature.
 * - Authorization (requireRole): "Are you allowed to do this?" → Checks roles.
 * These are separate middleware because not every protected route needs role checks.
 *
 * TOKEN EXTRACTION:
 * Tokens are extracted from the Authorization header:
 *   Authorization: Bearer <token>
 * WHY not cookies for access tokens:
 * - Access tokens in cookies require CSRF protection
 * - Bearer tokens in headers are CSRF-safe by nature (browsers don't auto-send headers)
 * - Mobile apps and API clients cannot use cookies easily
 *
 * ACCESS TOKEN BLOCKLIST CHECK:
 * After verifying the JWT signature, we check Redis to see if this token's jti
 * has been blocklisted (happens on logout). This adds ~1ms Redis latency per request
 * but closes the window where a logged-out token remains valid.
 *
 * req.user payload set by verifyToken:
 * {
 *   id: "64a1b2c3...",    // MongoDB _id as string
 *   jti: "uuid-...",      // JWT ID (for blocklisting)
 *   exp: 1234567890,      // Expiry timestamp (for logout blocklist TTL)
 *   iat: 1234567000,      // Issued at timestamp
 * }
 */

import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { getRedisClient } from '../config/redis.js';
import { ROLE_HIERARCHY } from '../constants/roles.js';
import config from '../config/env.config.js';
import logger from '../config/logger.js';

/**
 * Extracts the Bearer token from the Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove "Bearer " prefix
}

/**
 * Authentication middleware.
 * Verifies the JWT access token and attaches the decoded payload to req.user.
 * Also checks the Redis blocklist for logged-out tokens.
 */
export async function verifyToken(req, res, next) {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw ApiError.unauthorized('No authentication token provided.');
    }

    // Verify signature, expiry, issuer, and audience
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret, {
        algorithms: ['HS256'],
        issuer: 'collabspace-api',
        audience: 'collabspace-client',
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Your session has expired. Please refresh your token.');
      }
      if (err.name === 'JsonWebTokenError') {
        throw ApiError.unauthorized('Invalid authentication token.');
      }
      throw ApiError.unauthorized('Authentication failed.');
    }

    // Check if this token has been blocklisted (i.e., user logged out)
    try {
      const redis = getRedisClient();
      const isBlocklisted = await redis.get(`blocklist:${decoded.jti}`);
      if (isBlocklisted) {
        throw ApiError.unauthorized('Token has been revoked. Please log in again.');
      }
    } catch (err) {
      // If the error is our ApiError, re-throw it
      if (err.isOperational) throw err;
      // If Redis is down, we can choose to:
      // a) Allow the request (availability over security) — chosen here for development
      // b) Deny the request (security over availability) — recommended for production
      // For production, uncomment the next line:
      // throw ApiError.internal('Authentication service unavailable.');
      logger.warn(`[AuthMiddleware] Redis blocklist check failed: ${err.message}`);
    }

    // Attach decoded payload to req.user for use in controllers and services
    req.user = {
      id: decoded.sub,
      jti: decoded.jti,
      exp: decoded.exp,
      iat: decoded.iat,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authorization middleware factory.
 * Checks that the authenticated user has at least the required role level
 * within the specified context (workspace).
 *
 * Usage (role required for workspace-level access):
 *   router.delete('/workspace/:id', verifyToken, requireRole('admin'), controller)
 *
 * NOTE: This middleware works for SYSTEM-level role checks.
 * For WORKSPACE-level role checks (user's role within a specific workspace),
 * use the workspace authorization middleware (coming in Day 3).
 *
 * @param {...string} allowedRoles - One or more roles that are allowed
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    const userRole = req.user.role;

    // Check if the user's role is in the allowed roles list
    const isAllowed = allowedRoles.some(
      (requiredRole) =>
        ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
    );

    if (!isAllowed) {
      return next(
        ApiError.forbidden(
          `Access denied. This action requires one of: ${allowedRoles.join(', ')}.`
        )
      );
    }

    next();
  };
}

/**
 * Optional authentication middleware.
 * Attempts to authenticate the user but does NOT fail if no token is present.
 * Useful for routes that behave differently for authenticated vs anonymous users.
 * (e.g., public project view — show more details if authenticated)
 */
export async function optionalAuth(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  // Reuse verifyToken logic but don't fail on errors
  try {
    await verifyToken(req, res, next);
  } catch {
    req.user = null;
    next();
  }
}
