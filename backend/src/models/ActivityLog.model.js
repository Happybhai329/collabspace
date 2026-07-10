/**
 * src/models/ActivityLog.model.js
 *
 * PURPOSE:
 * Immutable audit trail of all significant actions in the system.
 * Powers the "Activity" feed seen in task detail views and workspace dashboards.
 * Critical for compliance, debugging, and understanding what happened in a project.
 *
 * IMMUTABILITY:
 * Activity logs must NEVER be updated or deleted (audit integrity).
 * WHY: If a user deletes a task, the activity log of that task's lifecycle must survive.
 * This is enforced at the application layer (no updateOne/deleteOne in the service).
 * For regulated industries, this would be further enforced at the DB level via
 * MongoDB Atlas auditing.
 *
 * POLYMORPHIC ENTITY:
 * Same pattern as Notification — entityType + entityId.
 * Allows logging actions on Tasks, Projects, Boards, etc. with one schema.
 *
 * CHANGE TRACKING:
 * The `changes` subdocument records what changed (before → after).
 * Example: { field: 'status', from: 'todo', to: 'in_progress' }
 * This enables "Jane changed status from Todo to In Progress" activity strings.
 *
 * METADATA:
 * Stores request metadata (IP, user agent) for security auditing.
 *
 * INDEXING STRATEGY:
 * Activity logs are write-heavy and read in time-descending order.
 * Don't over-index: every index slows writes.
 *
 * SCALABILITY:
 * At very high volume (millions of records), consider:
 * - Capped collections (fixed-size circular buffer)
 * - TimeSeries collections (MongoDB 5.0+)
 * - Archiving old logs to cold storage (S3 + Athena)
 */

import mongoose from 'mongoose';
import { ACTIVITY_ACTION, ENTITY_TYPE } from '../constants/enums.js';

const changeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },  // e.g., 'status', 'assignee', 'title'
    from: { type: mongoose.Schema.Types.Mixed, default: null }, // previous value
    to: { type: mongoose.Schema.Types.Mixed, default: null },   // new value
  },
  { _id: false }
);

const activityLogSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      // The user who performed the action
    },
    action: {
      type: String,
      enum: Object.values(ACTIVITY_ACTION),
      required: true,
    },
    // ── Polymorphic Entity ─────────────────────────────────────────────────
    entityType: {
      type: String,
      enum: Object.values(ENTITY_TYPE),
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // Snapshot of the entity's display name at time of action
    // (entity could be deleted later; we still want to show "Task MOBILE-42")
    entitySnapshot: {
      type: String,
      default: '',
      maxlength: 500,
    },
    // ── Change Details ─────────────────────────────────────────────────────
    changes: {
      type: [changeSchema],
      default: [],
    },
    // ── Computed Display String ────────────────────────────────────────────
    // Pre-built human-readable description of the activity
    // Example: "Alice moved MOBILE-42 from 'To Do' to 'In Progress'"
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    // ── Context ────────────────────────────────────────────────────────────
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    // ── Security Metadata ─────────────────────────────────────────────────
    metadata: {
      ipAddress: { type: String, default: null },
      userAgent: { type: String, default: null },
    },
  },
  {
    // Only createdAt — no updatedAt because logs are immutable
    timestamps: { createdAt: true, updatedAt: false },
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
// Activity feed for a specific entity (e.g., task detail view)
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

// Workspace-level activity feed (workspace dashboard)
activityLogSchema.index({ workspace: 1, createdAt: -1 });

// Actor-based feed ("what did user X do?")
activityLogSchema.index({ actor: 1, workspace: 1, createdAt: -1 });

// Project-level activity
activityLogSchema.index({ project: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
