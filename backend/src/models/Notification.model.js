/**
 * src/models/Notification.model.js
 *
 * PURPOSE:
 * In-app notification inbox for each user.
 * Notifications are created when significant events happen:
 * - Task assigned to you
 * - Someone comments on your task
 * - You are @mentioned
 * - Your role changes
 * - Workspace invitation
 *
 * DESIGN CHOICES:
 * - Each notification is a separate document (not embedded in User)
 *   WHY: A user could have thousands of notifications. Embedding would
 *   blow up the User document. Separate collection allows pagination and
 *   efficient "mark all as read" operations (updateMany with single query).
 *
 * - Polymorphic `entity` reference (entityType + entityId)
 *   WHY: Notifications can reference tasks, comments, workspaces, etc.
 *   Using a polymorphic reference avoids creating separate notification models
 *   for each entity type.
 *
 * - No push/email sending here. This is the DB record only.
 *   Push/email is handled by the notification service (Day 8+).
 *
 * INDEXES:
 * - { recipient, isRead, createdAt }: primary pattern — "my unread notifications"
 *
 * TTL INDEX:
 * Read notifications expire after 30 days automatically.
 * WHY: Old read notifications have no value and would accumulate forever.
 * MongoDB TTL index handles cleanup automatically at the DB level.
 */

import mongoose from 'mongoose';
import { NOTIFICATION_TYPE, ENTITY_TYPE } from '../constants/enums.js';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // null for system-generated notifications (e.g., deadline reminders)
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true,
    },
    // ── Polymorphic Entity Reference ───────────────────────────────────────
    entityType: {
      type: String,
      enum: Object.values(ENTITY_TYPE),
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // The actual document ID — Task ID, Comment ID, etc.
      // No explicit ref because it's polymorphic (resolved by entityType)
    },
    // ── Content ────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: true,
      maxlength: 200,
      // Short notification title: "Alice assigned you to MOBILE-42"
    },
    message: {
      type: String,
      maxlength: 500,
      default: '',
      // Longer context: the task title, comment excerpt, etc.
    },
    // ── State ──────────────────────────────────────────────────────────────
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // ── TTL Field for Auto-Expiry ───────────────────────────────────────────
    // TTL index: read notifications expire 30 days after being read
    expiresAt: {
      type: Date,
      default: null,
      // Set to (readAt + 30 days) when notification is read
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Primary: "show me my unread notifications, newest first"
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// TTL index: auto-delete documents where expiresAt is in the past
// MongoDB checks this every 60 seconds (not instant, but acceptable)
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.index({ recipient: 1, workspace: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
