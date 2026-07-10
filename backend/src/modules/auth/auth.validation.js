/**
 * src/modules/auth/auth.validation.js
 *
 * Zod schemas for validating all authentication-related requests.
 *
 * WHY Zod over Joi:
 * - TypeScript-first (we may migrate later)
 * - Better tree-shaking (smaller bundle if shared with frontend)
 * - Excellent error messages out of the box
 * - Active development and ecosystem support
 *
 * WHY server-side validation even though the frontend validates too:
 * - Never trust the client. Anyone with curl can bypass frontend validation.
 * - API keys, mobile apps, and third-party integrations bypass the frontend entirely.
 * - Defense in depth: frontend validation is for UX, backend validation is for security.
 *
 * VALIDATION RULES:
 * - Password: min 8 chars, must have 1 uppercase, 1 lowercase, 1 number, 1 special char
 * - Email: normalized to lowercase
 * - Username: lowercase alphanumeric + underscores/hyphens
 * - All string inputs: trimmed to prevent whitespace-only values
 */

import { z } from 'zod';

// ── Reusable Field Validators ─────────────────────────────────────────────────

const passwordSchema = z
  .string({ required_error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password cannot exceed 128 characters.')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]+$/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&_-#).'
  );

const emailSchema = z
  .string({ required_error: 'Email is required.' })
  .email('Please provide a valid email address.')
  .toLowerCase()
  .trim();

const usernameSchema = z
  .string({ required_error: 'Username is required.' })
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username cannot exceed 30 characters.')
  .regex(
    /^[a-z0-9_-]+$/,
    'Username can only contain lowercase letters, numbers, underscores, and hyphens.'
  )
  .toLowerCase()
  .trim();

// ── Auth Schemas ──────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    firstName: z
      .string({ required_error: 'First name is required.' })
      .min(2, 'First name must be at least 2 characters.')
      .max(50, 'First name cannot exceed 50 characters.')
      .trim(),
    lastName: z
      .string({ required_error: 'Last name is required.' })
      .min(2, 'Last name must be at least 2 characters.')
      .max(50, 'Last name cannot exceed 50 characters.')
      .trim(),
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Please confirm your password.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'], // Show the error on the confirmPassword field
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password cannot be empty.'),
  // We don't apply the complexity rules here intentionally:
  // If someone has an account with an old (simpler) password, they should still be able to log in.
  // Complexity is enforced only on registration and password change.
});

export const refreshTokenSchema = z.object({
  // Accepts refresh token from request body (alternative to httpOnly cookie)
  // The middleware checks BOTH the cookie and the body for flexibility
  refreshToken: z
    .string({ required_error: 'Refresh token is required.' })
    .min(1, 'Refresh token cannot be empty.')
    .optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Current password is required.' })
      .min(1, 'Current password cannot be empty.'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string({ required_error: 'Please confirm your new password.' }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match.',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password.',
    path: ['newPassword'],
  });
