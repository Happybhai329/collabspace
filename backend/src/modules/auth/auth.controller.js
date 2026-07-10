/**
 * src/modules/auth/auth.controller.js
 *
 * HTTP layer for authentication.
 *
 * WHY thin controllers:
 * Controllers only do THREE things:
 * 1. Extract data from the request
 * 2. Call the service
 * 3. Format the HTTP response
 *
 * No business logic here. No DB queries here. No validation here.
 * This makes controllers trivially testable and swappable.
 *
 * COOKIE STRATEGY:
 * Refresh tokens are stored in httpOnly cookies.
 * WHY: JavaScript cannot read httpOnly cookies, preventing XSS attacks from stealing tokens.
 * The cookie is also SameSite=Lax, blocking CSRF from cross-origin forms.
 * For SPAs on the same domain, this is the Gold Standard approach.
 */

import * as AuthService from './auth.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import asyncWrapper from '../../utils/asyncWrapper.js';
import config from '../../config/env.config.js';

// ── Cookie Options ────────────────────────────────────────────────────────────

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,           // Not accessible via document.cookie (XSS protection)
    secure: config.cookie.secure, // true in production (requires HTTPS)
    sameSite: config.cookie.sameSite, // 'lax' prevents CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    // path: '/' — refresh tokens are used only at /auth/refresh
    // Restricting path would be more secure but complicates mobile clients
  };
}

// ── Controller Methods ────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new user account and issues tokens.
 */
export const register = asyncWrapper(async (req, res) => {
  const { user, accessToken, refreshToken } = await AuthService.register(req.body);

  // Set refresh token as httpOnly cookie
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());

  return ApiResponse.created(res, 'Account created successfully.', {
    user,
    accessToken,
    // Note: refreshToken is in the cookie, NOT in the response body
    // This prevents refresh token leakage via logging, XSS, etc.
  });
});

/**
 * POST /api/v1/auth/login
 * Authenticates user and issues tokens.
 */
export const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await AuthService.login(email, password);

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());

  return ApiResponse.ok(res, 'Logged in successfully.', {
    user,
    accessToken,
  });
});

/**
 * POST /api/v1/auth/refresh
 * Issues a new access token using the refresh token.
 * Reads from httpOnly cookie first, falls back to request body.
 */
export const refreshToken = asyncWrapper(async (req, res) => {
  // Prefer cookie (web browsers), fall back to body (mobile apps)
  const incomingToken =
    req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

  const { accessToken, refreshToken: newRefreshToken } =
    await AuthService.refreshAccessToken(incomingToken);

  // Rotate the cookie with the new refresh token
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, getRefreshTokenCookieOptions());

  return ApiResponse.ok(res, 'Token refreshed successfully.', { accessToken });
});

/**
 * POST /api/v1/auth/logout
 * Invalidates the current session.
 * Requires authentication middleware.
 */
export const logout = asyncWrapper(async (req, res) => {
  // req.user is set by the auth middleware
  const { id: userId, jti, exp } = req.user;

  await AuthService.logout(userId, jti, exp);

  // Clear the refresh token cookie
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  });

  return ApiResponse.ok(res, 'Logged out successfully.', null);
});

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's profile.
 * Requires authentication middleware.
 */
export const getMe = asyncWrapper(async (req, res) => {
  const user = await AuthService.getMe(req.user.id);
  return ApiResponse.ok(res, 'User profile fetched successfully.', { user });
});
