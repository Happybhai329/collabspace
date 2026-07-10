/**
 * src/middleware/validate.middleware.js
 *
 * Generic Zod validation middleware factory.
 *
 * WHY a generic factory instead of per-route inline validation:
 * - One function handles ALL validation needs (body, query, params)
 * - Consistent error format — validation errors always look the same
 * - Eliminates duplicated try-catch in every controller
 * - Zod's error mapping produces field-level errors that frontend forms can bind to
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), AuthController.register)
 *
 * Error Format Produced:
 * {
 *   "success": false,
 *   "statusCode": 422,
 *   "message": "Validation failed.",
 *   "errors": [
 *     { "field": "email", "message": "Invalid email address." },
 *     { "field": "password", "message": "Password too short." }
 *   ]
 * }
 *
 * WHICH PART OF THE REQUEST TO VALIDATE:
 * By default, validates req.body.
 * Pass { target: 'query' } or { target: 'params' } to validate other parts.
 */

import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} [target='body'] - Request part to validate
 * @returns {import('express').RequestHandler} Express middleware
 */
export function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      // Map Zod's flat error list to our standardized error format
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'), // e.g., 'password' or 'address.city'
        message: err.message,
      }));

      return next(ApiError.unprocessable('Validation failed.', errors));
    }

    // Replace the request target with the parsed (and transformed) data
    // WHY: Zod transformations (e.g., .toLowerCase(), .trim()) have been applied
    // If we skip this, controllers would receive the original untransformed input
    req[target] = result.data;

    next();
  };
}
