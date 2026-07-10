/**
 * src/utils/ApiResponse.js
 *
 * Standard API response wrapper.
 *
 * WHY a response standard matters:
 * - Frontend devs can write ONE response handler instead of adapting to each endpoint
 * - API consumers know exactly what shape to expect
 * - Consistent structure allows API gateways and monitoring tools to parse responses
 * - Prevents the anti-pattern of returning raw Mongoose objects (leaks schema internals)
 *
 * Response Envelope:
 * {
 *   "success": true,
 *   "statusCode": 200,
 *   "message": "Users fetched successfully.",
 *   "data": { ... },
 *   "meta": { "page": 1, "total": 100 }  // Optional, for paginated responses
 * }
 */

export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message    - Human-readable message
   * @param {*} data            - Response payload (object, array, or null)
   * @param {object} [meta]     - Optional metadata (pagination, counts, etc.)
   */
  constructor(statusCode, message, data = null, meta = null) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;

    // Only include meta in the response if it's provided
    if (meta !== null) {
      this.meta = meta;
    }
  }

  /**
   * Sends the response via Express res object.
   * Usage: return new ApiResponse(200, 'OK', data).send(res);
   */
  send(res) {
    return res.status(this.statusCode).json(this);
  }
}

// ── Static Factory Methods ───────────────────────────────────────────────────
// These save boilerplate in controllers by encapsulating common patterns.

ApiResponse.ok = (res, message, data, meta) =>
  new ApiResponse(200, message, data, meta).send(res);

ApiResponse.created = (res, message, data) =>
  new ApiResponse(201, message, data).send(res);

ApiResponse.noContent = (res) =>
  res.status(204).send();
