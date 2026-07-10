/**
 * src/models/Board.model.js
 *
 * PURPOSE:
 * A board is a visual workspace (Kanban or Scrum sprint board) within a project.
 * A project can have multiple boards (e.g., "Development Board", "Design Board").
 *
 * RELATIONSHIPS:
 * - Board → Project (many-to-one)
 * - Board → Workspace (many-to-one): denormalized for query efficiency
 * - Board → Column (one-to-many): ordered columns within the board
 *
 * WHY denormalize workspace reference:
 * Many queries need to filter boards by workspace AND project. Without the workspace
 * field here, we'd need to $lookup to Project first. At scale (millions of boards),
 * this JOIN becomes expensive. Denormalization is a deliberate trade-off.
 * Cost: we must update this field if a project moves workspaces (rare operation).
 *
 * INDEXES:
 * - { project, isArchived }: primary query pattern — "active boards in project X"
 * - { workspace }: for workspace-level board overview
 */

import mongoose from 'mongoose';
import { BOARD_TYPE } from '../constants/enums.js';

const boardSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Board must belong to a project.'],
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      // Denormalized from project for query efficiency
    },
    name: {
      type: String,
      required: [true, 'Board name is required.'],
      trim: true,
      minlength: [2, 'Board name must be at least 2 characters.'],
      maxlength: [100, 'Board name cannot exceed 100 characters.'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters.'],
      default: '',
    },
    type: {
      type: String,
      enum: Object.values(BOARD_TYPE),
      default: BOARD_TYPE.KANBAN,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // ── Column Order ────────────────────────────────────────────────────────
    // Stores ordered array of Column IDs.
    // WHY: Ordering columns requires an ordered list. Embedding just IDs keeps
    // this array small (each column ID is 12 bytes). Full column data is in Column collection.
    columnOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Column',
      },
    ],
    // ── Scrum-specific fields (only relevant when type === 'scrum') ─────────
    currentSprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint', // Sprint model to be created in Day 6
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
      // The first board created for a project is marked as default
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
boardSchema.index({ project: 1, isArchived: 1 });
boardSchema.index({ workspace: 1, isArchived: 1 });
boardSchema.index({ createdBy: 1 });

const Board = mongoose.model('Board', boardSchema);

export default Board;
