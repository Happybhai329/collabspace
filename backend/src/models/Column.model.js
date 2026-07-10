/**
 * src/models/Column.model.js
 *
 * PURPOSE:
 * Represents a column within a Kanban/Scrum board (e.g., "To Do", "In Progress", "Done").
 * Columns contain tasks and define the workflow stages.
 *
 * RELATIONSHIPS:
 * - Column → Board (many-to-one)
 * - Column → Workspace (many-to-one): denormalized
 * - Column → Task (one-to-many): tasks live in columns
 *
 * ORDERING STRATEGY:
 * Column ordering is managed in Board.columnOrder (an array of Column IDs).
 * WHY not a `position: Number` field on Column:
 * - Reordering with a position number requires updating ALL subsequent columns (N writes)
 * - The array approach requires only ONE write (update the Board's columnOrder array)
 * - At scale, this is significantly more efficient for drag-and-drop operations
 *
 * Task ordering within a column uses the same array strategy (taskOrder on Column).
 *
 * WIP LIMITS:
 * Work-in-Progress limits (Lean/Kanban principle): warn when column exceeds N tasks.
 * This is a read-time check, not a write blocker (users can override with warning).
 *
 * INDEXES:
 * - board: primary access pattern — "all columns for board X"
 */

import mongoose from 'mongoose';

const columnSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'Column must belong to a board.'],
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      // Denormalized for permission checks without additional lookups
    },
    name: {
      type: String,
      required: [true, 'Column name is required.'],
      trim: true,
      minlength: [1, 'Column name must be at least 1 character.'],
      maxlength: [50, 'Column name cannot exceed 50 characters.'],
    },
    color: {
      type: String,
      default: '#94a3b8',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex code.'],
    },
    // ── Task Order ─────────────────────────────────────────────────────────
    // Ordered array of Task IDs in this column.
    // Same rationale as Board.columnOrder — single write for reordering.
    taskOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    // ── WIP Limit (Kanban principle) ───────────────────────────────────────
    wipLimit: {
      type: Number,
      default: null,
      min: [1, 'WIP limit must be at least 1.'],
      // null = no limit
    },
    // ── Automation / Status Mapping ────────────────────────────────────────
    // Maps this column to a task status for automation rules
    // (e.g., "when task moves to Done column, auto-set status to 'done'")
    mappedStatus: {
      type: String,
      enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled', null],
      default: null,
    },
    isCollapsed: {
      type: Boolean,
      default: false,
      // Board-level UI preference (per-user collapse is a future enhancement)
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
columnSchema.index({ board: 1 });
columnSchema.index({ workspace: 1 });

const Column = mongoose.model('Column', columnSchema);

export default Column;
