/**
 * src/models/User.model.js
 *
 * PURPOSE:
 * Represents the identity of every person in the system. The User document
 * is the authentication anchor — all other documents reference it.
 *
 * RELATIONSHIPS:
 * - User → WorkspaceMember (one-to-many): a user can belong to many workspaces
 * - User → Task (one-to-many): tasks are created by and assigned to users
 * - User → Comment (one-to-many): users write comments
 * - User → Notification (one-to-many): users receive notifications
 * - User → ActivityLog (one-to-many): users generate activity
 *
 * SECURITY NOTES:
 * - Password is NEVER returned in queries (select: false)
 * - refreshToken is NEVER returned (select: false)
 * - Password hashing happens in pre-save hook, NOT in the service
 *   (WHY: ensures hashing even if password is changed via model.save() anywhere in the codebase)
 *
 * INDEXES:
 * - email: unique index (enforced at DB level, not just app level)
 * - username: unique index
 * - createdAt: for admin listing with date filters
 *
 * SCALABILITY:
 * - avatar: stores URL (to CDN/S3), not binary data — keeps document size small
 * - isVerified: email verification flag (Day 3: email service)
 * - isActive: soft-delete pattern — deactivated users retain data integrity
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/env.config.js';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required.'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters.'],
      maxlength: [50, 'First name cannot exceed 50 characters.'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required.'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters.'],
      maxlength: [50, 'Last name cannot exceed 50 characters.'],
    },
    username: {
      type: String,
      required: [true, 'Username is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters.'],
      maxlength: [30, 'Username cannot exceed 30 characters.'],
      match: [
        /^[a-z0-9_-]+$/,
        'Username can only contain lowercase letters, numbers, underscores, and hyphens.',
      ],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      select: false, // NEVER return password in queries
    },
    avatar: {
      type: String,
      default: null,
      // Stores CDN URL (e.g., https://cdn.collabspace.io/avatars/user-id.jpg)
      // Never store binary data in MongoDB documents
    },
    bio: {
      type: String,
      maxlength: [280, 'Bio cannot exceed 280 characters.'],
      default: '',
    },
    // ── Authentication Fields ───────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      // Soft delete: deactivating preserves referential integrity
      // (tasks, comments, activity logs remain intact and readable)
    },
    refreshToken: {
      type: String,
      default: null,
      select: false, // NEVER return refresh token in queries
    },
    // Stores hashed email verification / password reset tokens
    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },
    emailVerificationTokenExpiry: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetTokenExpiry: {
      type: Date,
      default: null,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // ── Preferences (future expansion) ─────────────────────────────────────
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      notifications: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: {
      // Transform applied when document is serialized to JSON (API response)
      virtuals: true,
      transform(doc, ret) {
        // Defensive: ensure sensitive fields are never leaked
        delete ret.password;
        delete ret.refreshToken;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.__v;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ── Virtual Fields ────────────────────────────────────────────────────────────

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compound index for admin queries filtering active users by creation date
userSchema.index({ createdAt: -1, isActive: 1 });

// ── Pre-Save Hook: Password Hashing ──────────────────────────────────────────
/**
 * WHY pre-save hook vs service-level hashing:
 * If we hash in the service, a future developer might bypass the service
 * and call User.save() directly, storing plaintext passwords.
 * The hook makes hashing automatic and impossible to bypass.
 */
userSchema.pre('save', async function (next) {
  // Only re-hash if the password field was actually modified
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, config.bcrypt.saltRounds);
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Compares a plain-text password against the stored hash.
 * Must call with .select('+password') on the query first.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Returns a safe public representation of the user.
 * Useful when returning user data in nested objects (e.g., task.assignee).
 */
userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    bio: this.bio,
  };
};

const User = mongoose.model('User', userSchema);

export default User;
