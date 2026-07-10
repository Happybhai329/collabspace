/**
 * src/utils/asyncWrapper.js
 *
 * Eliminates try-catch boilerplate in async route handlers.
 *
 * WHY this exists:
 * Without asyncWrapper, every async controller needs:
 *   try { ... } catch(err) { next(err) }
 *
 * With asyncWrapper, controllers can throw errors naturally and the
 * global error handler catches them automatically.
 *
 * Usage:
 *   router.get('/users', asyncWrapper(async (req, res) => {
 *     const users = await UserService.getAll();
 *     ApiResponse.ok(res, 'Users fetched.', users);
 *   }));
 *
 * Trade-off: Stack traces are preserved because we pass the error to next()
 * rather than swallowing it. This is critical for production debugging.
 */

/**
 * @param {Function} fn - Async route handler or middleware function
 * @returns {Function} Express middleware that catches async errors
 */
const asyncWrapper = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncWrapper;
