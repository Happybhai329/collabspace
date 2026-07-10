/**
 * src/utils/ApiError.js
 *
 * Custom error class for operational errors.
 *
 * WHY extend Error:
 * - Gives us instanceof checks in the global error handler
 * - Separates "operational errors" (expected: 404, 401) from "programmer errors" (unexpected: bugs)
 * - Allows attaching HTTP status codes and extra context to errors
 * - Works seamlessly with the asyncWrapper — thrown errors bubble up to the global handler
 *
 * Operational vs Programmer Errors (critical distinction):
 * - Operational: User not found, invalid password, duplicate email → recover gracefully, send 4xx
 * - Programmer: null reference, syntax error → crash (or restart), send 500, alert on-call
 *
 * This class represents OPERATIONAL errors only.
 */

export class ApiError extends Error {
  /**
   * @param {number} statusCode    - HTTP status code (400, 401, 403, 404, 409, 422, 500...)
   * @param {string} message       - Human-readable error message (safe to expose to clients)
   * @param {Array}  [errors]      - Validation error details (array of field-level errors)
   * @param {string} [stack]       - Optional stack trace override (rarely needed)
   */
  constructor(statusCode, message, errors = [], stack = '') {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;       // Field-level validation errors
    this.isOperational = true;  // Flag: this is an expected error, not a bug

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ── Static Factory Methods ───────────────────────────────────────────────────
// Semantically named constructors make controller code self-documenting.

ApiError.badRequest = (message, errors = []) =>
  new ApiError(400, message, errors);

ApiError.unauthorized = (message = 'Authentication required.') =>
  new ApiError(401, message);

ApiError.forbidden = (message = 'You do not have permission to perform this action.') =>
  new ApiError(403, message);

ApiError.notFound = (message = 'The requested resource was not found.') =>
  new ApiError(404, message);

ApiError.conflict = (message) =>
  new ApiError(409, message);

ApiError.unprocessable = (message, errors = []) =>
  new ApiError(422, message, errors);

ApiError.internal = (message = 'An unexpected error occurred. Please try again later.') =>
  new ApiError(500, message);

ApiError.tooManyRequests = (message = 'Too many requests. Please slow down.') =>
  new ApiError(429, message);
