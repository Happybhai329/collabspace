/**
 * src/models/Project.model.js
 *
 * PURPOSE:
 * A project is a logical grouping of boards and tasks within a workspace.
 * Maps to a product, team, or initiative (e.g., "Mobile App", "Marketing Q4").
 *
 * RELATIONSHIPS:
 * - Project → Workspace (many-to-one)
 * - Project → Board (one-to-many)
 * - Project → User as lead (many-to-one)
 *
 * DESIGN DECISION:
 * Projects have a key (e.g., "MOBILE", "MKT") for short task identifiers
 * like "MOBILE-123". This is the Jira-style approach and loved by developers.
 *
 * INDEXES:
 * - { workspace, key }: unique within workspace (MOBILE is unique per workspace)
 * - { workspace, status }: for listing active projects in a workspace
 */

import mongoose from 'mongoose';
import { PROJECT_STATUS } from '../constants/enums.js';

const projectSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Project must belong to a workspace.'],
    },
    name: {
      type: String,
      required: [true, 'Project name is required.'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters.'],
      maxlength: [100, 'Project name cannot exceed 100 characters.'],
    },
    key: {
      type: String,
      required: [true, 'Project key is required.'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Project key must be at least 2 characters.'],
      maxlength: [10, 'Project key cannot exceed 10 characters.'],
      match: [/^[A-Z0-9]+$/, 'Project key can only contain uppercase letters and numbers.'],
      // Example: "MOBILE", "MKT24", "BACKEND"
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters.'],
      default: '',
    },
    icon: {
      type: String,
      default: null,
      // Emoji string or CDN URL to project icon
    },
    color: {
      type: String,
      default: '#6366f1',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex code.'],
    },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      default: PROJECT_STATUS.ACTIVE,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // Project lead is responsible for the project (not necessarily the creator)
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // ── Task Counter (for sequential task IDs like MOBILE-1, MOBILE-2) ─────
    taskCounter: {
      type: Number,
      default: 0,
      min: 0,
      // WHY here: MongoDB's $inc on this field is atomic, preventing duplicate IDs
      // even under concurrent task creation
    },
    // ── Timeline ──────────────────────────────────────────────────────────
    startDate: {
      type: Date,
      default: null,
    },
    targetDate: {
      type: Date,
      default: null,
    },
    boardCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
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
// Key must be unique within a workspace (MOBILE can exist in two different workspaces)
projectSchema.index({ workspace: 1, key: 1 }, { unique: true });
projectSchema.index({ workspace: 1, status: 1, createdAt: -1 });
projectSchema.index({ lead: 1 });
projectSchema.index({ createdBy: 1 });

const Project = mongoose.model('Project', projectSchema);

export default Project;
