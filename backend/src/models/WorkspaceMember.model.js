/**
 * src/models/WorkspaceMember.model.js
 *
 * PURPOSE:
 * Implements the many-to-many relationship between Users and Workspaces,
 * carrying role and invitation metadata.
 *
 * WHY a separate collection vs embedding:
 * - A single workspace could have thousands of members (enterprise tier)
 * - Separate collection allows efficient queries like "get all workspaces for user X"
 *   with a single index scan, no $lookup needed on large documents
 * - Role changes only touch this small document, not the entire Workspace document
 * - Invitation workflow state machine is naturally expressed here
 *
 * RELATIONSHIPS:
 * - WorkspaceMember → User (many-to-one)
 * - WorkspaceMember → Workspace (many-to-one)
 * - WorkspaceMember → User as invitedBy (many-to-one)
 *
 * INDEXES:
 * - Compound { workspace, user }: unique — prevents duplicate memberships
 * - user: for "get all workspaces for user" (dashboard listing)
 * - workspace: for "get all members of workspace" (workspace settings page)
 *
 * COMPOUND UNIQUE INDEX:
 * Critical! Without this, a race condition could create duplicate memberships.
 * The DB-level constraint is the last line of defense after app-level checks.
 */

import mongoose from 'mongoose';
import { ALL_ROLES, ROLES } from '../constants/roles.js';

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: {
        values: ALL_ROLES,
        message: '{VALUE} is not a valid role.',
      },
      required: true,
      default: ROLES.DEVELOPER,
    },
    // ── Invitation State Machine ────────────────────────────────────────────
    // States: pending → accepted | declined | revoked
    invitationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'revoked'],
      default: 'accepted',
      // 'accepted' for owner (auto-accepted at workspace creation)
      // 'pending' for invited members
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // null for the workspace owner (self-joined)
    },
    invitedAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    // ── Permissions Override (Advanced — Phase 2+) ──────────────────────────
    // Allows granting specific permissions beyond the role defaults
    // e.g., a Developer who can also manage billing
    // customPermissions: [{ type: String }],
    // Left as comment — do not implement until needed (YAGNI principle)
    isActive: {
      type: Boolean,
      default: true,
      // Deactivated = removed from workspace but record preserved for audit
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

// Primary compound index: prevents duplicate memberships, enables fast member lookup
workspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });

// Secondary indexes for common query patterns
workspaceMemberSchema.index({ user: 1, invitationStatus: 1 });
workspaceMemberSchema.index({ workspace: 1, role: 1, isActive: 1 });
workspaceMemberSchema.index({ workspace: 1, isActive: 1, createdAt: -1 });

const WorkspaceMember = mongoose.model('WorkspaceMember', workspaceMemberSchema);

export default WorkspaceMember;
