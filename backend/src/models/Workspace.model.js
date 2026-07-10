/**
 * src/models/Workspace.model.js
 *
 * PURPOSE:
 * The top-level organizational unit. Like a GitHub Organization or a Notion Workspace.
 * Everything (projects, boards, tasks) lives under a workspace.
 *
 * RELATIONSHIPS:
 * - Workspace → WorkspaceMember (one-to-many): members with roles
 * - Workspace → Project (one-to-many): workspace contains many projects
 * - Workspace.owner → User (many-to-one): owner is always a User
 *
 * WHY NOT embed members directly in the Workspace document:
 * - A workspace could have thousands of members
 * - Embedded arrays grow unboundedly and hit the 16MB BSON document limit
 * - The separate WorkspaceMember collection allows efficient role queries
 *   (e.g., "find all admins of workspace X" without loading the full workspace)
 *
 * INDEXES:
 * - slug: unique — used in URLs (collabspace.io/workspaces/my-company)
 * - owner: for "workspaces owned by user X" queries
 *
 * SCALABILITY:
 * - slug: human-readable URL identifier (generated from name, enforced unique)
 * - settings: embedded subdocument for workspace-level configuration
 *   (safe to embed because settings are bounded in size)
 */

import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required.'],
      trim: true,
      minlength: [2, 'Workspace name must be at least 2 characters.'],
      maxlength: [100, 'Workspace name cannot exceed 100 characters.'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      // Slugs are URL-safe: lowercase, alphanumeric, hyphens only
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens.'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters.'],
      default: '',
    },
    logo: {
      type: String,
      default: null,
      // CDN URL to workspace logo image
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Workspace must have an owner.'],
    },
    // ── Settings ───────────────────────────────────────────────────────────
    // Safe to embed: bounded size, always queried with the workspace
    settings: {
      isPublic: {
        type: Boolean,
        default: false,
        // Public workspaces allow non-members to view (future feature)
      },
      allowMemberInvites: {
        type: Boolean,
        default: true,
        // If false, only admins/owners can invite new members
      },
      defaultRole: {
        type: String,
        enum: ['developer', 'viewer'],
        default: 'developer',
        // Role assigned to newly invited members
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    // ── Metadata / Stats (denormalized for performance) ────────────────────
    // WHY denormalize: avoids expensive COUNT queries on the members collection
    // WHY not always: only worth it for frequently-read, rarely-updated counts
    memberCount: {
      type: Number,
      default: 1, // Owner is the first member
      min: 0,
    },
    projectCount: {
      type: Number,
      default: 0,
      min: 0,
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
workspaceSchema.index({ owner: 1, createdAt: -1 });
workspaceSchema.index({ isArchived: 1 });

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
