/**
 * src/modules/auth/auth.service.js
 *
 * Authentication business logic.
 *
 * WHY a Service layer:
 * Controllers should be thin — they parse HTTP requests and call services.
 * Services contain business logic and are NOT aware of HTTP (no req, res, next).
 * This separation means services can be called from:
 * - HTTP controllers
 * - Socket.io handlers (Day 4+)
 * - CLI scripts (seed, admin commands)
 * - Tests (without spinning up an HTTP server)
 *
 * TOKEN STRATEGY:
 * We use a dual-token strategy:
 * - Access Token (JWT, 15min): Short-lived. Sent in Authorization header.
 *   Stateless — can be verified without a DB/Redis call. Fast but not revocable.
 * - Refresh Token (JWT, 7d): Long-lived. Stored in httpOnly cookie.
 *   Semi-stateful — hashed version stored in DB (User.refreshToken).
 *   Can be revoked by clearing the DB value. Slower but secure.
 *
 * WHY hash the refresh token in the DB:
 * If the database is breached, raw refresh tokens would allow attackers to
 * impersonate users. Hashing (bcrypt) ensures database theft alone is not enough.
 *
 * WHY NOT store refresh tokens in Redis:
 * Redis is volatile — a restart clears all sessions, logging out all users.
 * MongoDB is persistent. We store the refresh token in MongoDB for durability.
 * Redis is used for ACCESS token blocklisting (logout before expiry).
 *
 * REFRESH TOKEN ROTATION:
 * On every /auth/refresh call, the old refresh token is invalidated and
 * a new one is issued. This limits the damage window if a refresh token is stolen.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../../models/User.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getRedisClient } from '../../config/redis.js';
import config from '../../config/env.config.js';
import logger from '../../config/logger.js';

// ── Token Generation ──────────────────────────────────────────────────────────

/**
 * Generates a signed JWT access token.
 * Payload is minimal — only ID and a jti (JWT ID) for revocation.
 * @param {string} userId - MongoDB User _id
 * @returns {{ token: string, jti: string }}
 */
function generateAccessToken(userId) {
  const jti = uuidv4(); // Unique ID for this specific token (used for blocklisting)
  const token = jwt.sign(
    { sub: userId.toString(), jti },
    config.jwt.accessSecret,
    {
      expiresIn: config.jwt.accessExpiresIn,
      algorithm: 'HS256',
      issuer: 'collabspace-api',
      audience: 'collabspace-client',
    }
  );
  return { token, jti };
}

/**
 * Generates a signed JWT refresh token.
 * @param {string} userId - MongoDB User _id
 * @returns {string} Signed refresh token
 */
function generateRefreshToken(userId) {
  return jwt.sign(
    { sub: userId.toString() },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
      algorithm: 'HS256',
      issuer: 'collabspace-api',
    }
  );
}

/**
 * Stores the hashed refresh token on the User document.
 * Uses bcrypt.hash (not SHA-256) to prevent timing attacks and rainbow tables.
 * @param {object} user - Mongoose User document
 * @param {string} refreshToken - Plain refresh token to hash and store
 */
async function storeRefreshToken(user, refreshToken) {
  const hashed = await bcrypt.hash(refreshToken, 10); // 10 rounds is enough for tokens
  user.refreshToken = hashed;
  await user.save({ validateBeforeSave: false });
}

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Registers a new user.
 * Throws ApiError for duplicate email/username (409) or any other failure.
 * @param {object} data - { firstName, lastName, username, email, password }
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 */
export async function register(data) {
  const { firstName, lastName, username, email, password } = data;

  // Check for existing user — check both email AND username in one query
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw ApiError.conflict('An account with this email address already exists.');
    }
    throw ApiError.conflict('This username is already taken. Please choose another.');
  }

  // Create user — password hashing happens in the pre-save hook
  const user = await User.create({
    firstName,
    lastName,
    username,
    email,
    password, // Plain text — bcrypt hook in User.model.js handles hashing
  });

  logger.info(`[AuthService] New user registered: ${user.email} (${user._id})`);

  // Generate tokens
  const { token: accessToken } = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Persist hashed refresh token
  await storeRefreshToken(user, refreshToken);

  // Return safe user data (no password, no tokens)
  return {
    user: user.toPublicProfile(),
    accessToken,
    refreshToken,
  };
}

/**
 * Authenticates a user with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 */
export async function login(email, password) {
  // Must use .select('+password') to override `select: false` on the password field
  const user = await User.findOne({ email }).select('+password +refreshToken');

  if (!user) {
    // Use the same error message for "user not found" and "wrong password"
    // WHY: Different messages would allow username enumeration attacks
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Please contact support.');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();

  // Generate tokens
  const { token: accessToken } = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Persist hashed refresh token (also saves lastLoginAt)
  await storeRefreshToken(user, refreshToken);

  logger.info(`[AuthService] User logged in: ${user.email} (${user._id})`);

  return {
    user: user.toPublicProfile(),
    accessToken,
    refreshToken,
  };
}

/**
 * Issues a new access token using a valid refresh token.
 * Implements refresh token rotation: old token is invalidated, new one issued.
 * @param {string} incomingRefreshToken - The refresh token from the cookie or body
 * @returns {{ accessToken: string, refreshToken: string }}
 */
export async function refreshAccessToken(incomingRefreshToken) {
  if (!incomingRefreshToken) {
    throw ApiError.unauthorized('Refresh token not provided.');
  }

  // 1. Verify the refresh token's signature and expiry
  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, config.jwt.refreshSecret, {
      algorithms: ['HS256'],
      issuer: 'collabspace-api',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired. Please log in again.');
    }
    throw ApiError.unauthorized('Invalid refresh token. Please log in again.');
  }

  // 2. Find the user and retrieve the stored hashed token
  const user = await User.findById(decoded.sub).select('+refreshToken');
  if (!user || !user.refreshToken) {
    throw ApiError.unauthorized('Session not found. Please log in again.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account deactivated. Please contact support.');
  }

  // 3. Compare incoming token with the stored hash
  const isTokenValid = await bcrypt.compare(incomingRefreshToken, user.refreshToken);
  if (!isTokenValid) {
    // This could indicate a token reuse attack — clear the stored token as a safety measure
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
    logger.warn(`[AuthService] Possible refresh token reuse detected for user ${user._id}`);
    throw ApiError.unauthorized('Invalid refresh token. Please log in again.');
  }

  // 4. Issue new tokens (rotation)
  const { token: newAccessToken } = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  await storeRefreshToken(user, newRefreshToken);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logs out the user by:
 * 1. Clearing the refresh token in the database
 * 2. Adding the access token's jti to Redis blocklist (until it expires)
 *
 * @param {string} userId - User ID from the verified JWT
 * @param {string} jti    - JWT ID from the access token payload (for blocklisting)
 * @param {number} accessTokenExp - Access token expiry timestamp (for TTL calculation)
 */
export async function logout(userId, jti, accessTokenExp) {
  // 1. Clear refresh token from database
  await User.findByIdAndUpdate(userId, { refreshToken: null });

  // 2. Blocklist the current access token in Redis until it naturally expires
  // WHY: JWTs are stateless. Without blocklisting, a logged-out user's access token
  // remains valid until it expires (up to 15 minutes). Blocklisting closes this window.
  try {
    const redis = getRedisClient();
    const ttl = accessTokenExp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(`blocklist:${jti}`, ttl, '1');
    }
  } catch (err) {
    // Non-fatal: if Redis is down, the token will expire naturally
    logger.error(`[AuthService] Failed to blocklist access token: ${err.message}`);
  }

  logger.info(`[AuthService] User ${userId} logged out.`);
}

/**
 * Returns the current authenticated user's profile.
 * @param {string} userId
 * @returns {object} Public user profile
 */
export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw ApiError.notFound('User not found.');
  }
  return user.toPublicProfile();
}
