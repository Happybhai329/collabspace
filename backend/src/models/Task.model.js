/**
 * src/models/Task.model.js
 *
 * PURPOSE:
 * The central entity of the entire system. A task (also called ticket, issue, or card)
 * represents a unit of work. This is the most-read, most-written document in the DB.
 *
 * RELATIONSHIPS:
 * - Task → Column (many-to-one): current column
 * - Task → Board (many-to-one): current board
 * - Task → Project (many-to-one): parent project
 * - Task → Workspace (many-to-one): denormalized
 * - Task → User as assignees (many-to-many): multiple people can work on a task
 * - Task → User as reporter (many-to-one): who created the task
 * - Task → Task as parent (self-referential): subtasks
 * - Task → Comment (one-to-many): in Comment collection
 * - Task → ActivityLog (one-to-many): in ActivityLog collection
 *
 * IDENTIFIER STRATEGY:
 * Each task gets a human-readable identifier (e.g., "MOBILE-42").
 * - project.key: comes from Project.key (denormalized)
 * - taskNumber: atomic increment from Project.taskCounter
 * This mirrors Jira/Linear and is loved by developers for referencing tasks.
 *
 * LABELS:
 * Simple string array (not a separate collection).
 * WHY: For most teams, labels are simple tags. A separate collection would add
 * complexity with minimal benefit. Migrate to a separate collection only if
 * label management (renaming, merging) becomes critical.
 *
 * ATTACHMENTS:
 * Array of CDN URLs. Files are uploaded to S3/Cloudinary (Day 8), URLs stored here.
 *
 * INDEXES:
 * Many indexes because tasks are queried in dozens of ways.
 * Every index has a cost (write speed, storage). Only index what's queried.
 */

import mongoose from 'mongoose';
import { TASK_STATUS, TASK_PRIORITY, TASK_TYPE } from '../constants/enums.js';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }, // bytes
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const taskSchema = new mongoose.Schema(
  {
    // ── Identification ──────────────────────────────────────────────────────
    taskNumber: {
      type: Number,
      required: true,
      // Set atomically from Project.taskCounter on creation
    },
    projectKey: {
      type: String,
      required: true,
      uppercase: true,
      // Denormalized from Project.key (rarely changes)
    },
    // identifier = `${projectKey}-${taskNumber}` — computed as a virtual

    // ── Hierarchy ───────────────────────────────────────────────────────────
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      default: null,
      // Tasks can exist without a board (backlog items)
    },
    column: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Column',
      default: null,
    },
    // ── Self-Referential for Subtasks ───────────────────────────────────────
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      // Only set for subtasks. Parent tasks have parent: null.
    },

    // ── Core Fields ─────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Task title is required.'],
      trim: true,
      minlength: [3, 'Task title must be at least 3 characters.'],
      maxlength: [500, 'Task title cannot exceed 500 characters.'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [50000, 'Description cannot exceed 50,000 characters.'],
      // Stores rich text as markdown or a JSON AST (e.g., from Tiptap/ProseMirror)
    },
    type: {
      type: String,
      enum: Object.values(TASK_TYPE),
      default: TASK_TYPE.TASK,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.TODO,
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(TASK_PRIORITY),
      default: TASK_PRIORITY.NONE,
      required: true,
    },

    // ── People ──────────────────────────────────────────────────────────────
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task must have a reporter.'],
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // ── Time & Planning ─────────────────────────────────────────────────────
    dueDate: {
      type: Date,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    estimatedHours: {
      type: Number,
      default: null,
      min: [0, 'Estimated hours cannot be negative.'],
    },
    loggedHours: {
      type: Number,
      default: 0,
      min: [0, 'Logged hours cannot be negative.'],
    },
    completedAt: {
      type: Date,
      default: null,
      // Set when status changes to 'done'
    },

    // ── Organization ────────────────────────────────────────────────────────
    labels: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],
    attachments: [attachmentSchema],

    // ── Story Points (for Scrum boards) ─────────────────────────────────────
    storyPoints: {
      type: Number,
      default: null,
      min: [0, 'Story points cannot be negative.'],
    },

    // ── Soft Delete ─────────────────────────────────────────────────────────
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
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

// ── Virtual: Human-Readable Identifier ───────────────────────────────────────
taskSchema.virtual('identifier').get(function () {
  return `${this.projectKey}-${this.taskNumber}`;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// These indexes reflect the actual query patterns of a Kanban board application

// Board view: get all tasks for a board, filtered by column
taskSchema.index({ board: 1, column: 1, isArchived: 1 });

// Project backlog view: all unarchived tasks in a project
taskSchema.index({ project: 1, isArchived: 1, status: 1 });

// "My tasks": all tasks assigned to me in a workspace
taskSchema.index({ assignees: 1, workspace: 1, isArchived: 1 });

// "Reported by me": tasks I created
taskSchema.index({ reporter: 1, workspace: 1 });

// Due date views and notifications
taskSchema.index({ dueDate: 1, status: 1, isArchived: 1 });

// Subtask lookup
taskSchema.index({ parent: 1 });

// Unique task identifier per project
taskSchema.index({ project: 1, taskNumber: 1 }, { unique: true });

// ── Pre-Save: Auto-set completedAt ───────────────────────────────────────────
taskSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === TASK_STATUS.DONE && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== TASK_STATUS.DONE) {
      this.completedAt = null;
    }
  }
  next();
});

const Task = mongoose.model('Task', taskSchema);

export default Task;
