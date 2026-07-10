/**
 * src/modules/auth/auth.routes.js
 *
 * Authentication route definitions.
 *
 * Route Design Principles:
 * - All routes are versioned (/api/v1/) — never break clients
 * - Validation middleware runs before controller
 * - Authentication middleware runs where required
 * - Route names follow REST conventions (nouns, not verbs)
 *
 * Route Protection Summary:
 * - POST /register   → public
 * - POST /login      → public
 * - POST /refresh    → public (but requires valid refresh token)
 * - POST /logout     → protected (requires valid access token)
 * - GET  /me         → protected
 */

import { Router } from 'express';
import * as AuthController from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from './auth.validation.js';

const router = Router();

// ── Public Routes ─────────────────────────────────────────────────────────────

router.post(
  '/register',
  validate(registerSchema),
  AuthController.register
);

router.post(
  '/login',
  validate(loginSchema),
  AuthController.login
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  AuthController.refreshToken
);

// ── Protected Routes ──────────────────────────────────────────────────────────

router.post(
  '/logout',
  verifyToken,
  AuthController.logout
);

router.get(
  '/me',
  verifyToken,
  AuthController.getMe
);

export default router;
