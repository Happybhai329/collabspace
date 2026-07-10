/**
 * src/middleware/errorHandler.middleware.js
 *
 * Global Express error handler.
 *
 * HOW IT WORKS:
 * Express identifies error-handling middleware by its 4-argument signature (err, req, res, next).
 * This middleware must be registered LAST in app.js (after all routes).
 * When any middleware calls next(error) or an async handler throws, it ends up here.
 *
 * ERROR CLASSIFICATION:
 * 1. ApiError (isOperational: true)  → Expected operational error → send structured response
 * 2. Mongoose ValidationError        → Invalid data submitted → map to 422
 * 3. Mongoose CastError             → Invalid ObjectId in URL → map to 404
 * 4. Mongoose duplicate key (11000)  → Duplicate unique field → map to 409
 * 5. JWT errors                     → Already handled in auth.middleware → shouldn't reach here
 * 6. Everything else                 → Unexpected programmer error → 500 + log stack trace
 *
 * PRODUCTION SAFETY:
 * Stack traces are NEVER sent to clients in production.
 * Error messages for unexpected errors are generic to prevent information leakage.
 *
 * RESPONSE FORMAT (consistent with ApiResponse):
 * {
 *   "success": false,
 *   "statusCode": 422,
 *   "message": "Validation failed.",
 *   "errors": [...],
 *   "stack": "..." // Only in development mode
 * }
 */

import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import logger from '../config/logger.js';
import config from '../config/env.config.js';

/**
 * Converts known library errors to ApiError instances.
 * This normalization step makes the rest of the handler simpler.
 * @param {Error} err
 * @returns {ApiError}
 */
function normalizeError(err) {
  // Already an operational ApiError — pass through
  if (err.isOperational) return err;

  // ── Mongoose Validation Error ─────────────────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.unprocessable('Validation failed.', errors);
  }

  // ── Mongoose Cast Error (invalid ObjectId) ────────────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.notFound(`Invalid ${err.path}: ${err.value} is not a valid ID.`);
  }

  // ── MongoDB Duplicate Key Error ────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field] || '';
    return ApiError.conflict(
      `The ${field} '${value}' is already in use. Please choose a different value.`
    );
  }

  // ── JWT Errors (should not reach here if auth middleware is correct) ──────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Authentication failed. Please log in again.');
  }

  // ── Unhandled / Programmer Error ──────────────────────────────────────────
  // Log the full error internally, but never expose it to the client
  logger.error({
    message: `[ErrorHandler] Unexpected error: ${err.message}`,
    stack: err.stack,
    name: err.name,
  });

  return new ApiError(
    500,
    config.isProd
      ? 'An unexpected server error occurred. Please try again later.'
      : err.message, // In dev, show the actual error message
    [],
    config.isDev ? err.stack : ''
  );
}

/**
 * Global Express error-handling middleware.
 * Must be the LAST middleware registered in app.js.
 * Must have exactly 4 parameters (err, req, res, next).
 */
// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  const normalizedError = normalizeError(err);

  // Log all errors (with different levels based on severity)
  if (normalizedError.statusCode >= 500) {
    logger.error({
      message: normalizedError.message,
      statusCode: normalizedError.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.warn({
      message: normalizedError.message,
      statusCode: normalizedError.statusCode,
      path: req.path,
      method: req.method,
    });
  }

  const response = {
    success: false,
    statusCode: normalizedError.statusCode,
    message: normalizedError.message,
  };

  // Include field-level errors if present (validation errors)
  if (normalizedError.errors && normalizedError.errors.length > 0) {
    response.errors = normalizedError.errors;
  }

  // Include stack trace in development for easier debugging
  if (config.isDev && normalizedError.stack) {
    response.stack = normalizedError.stack;
  }

  return res.status(normalizedError.statusCode).json(response);
}
