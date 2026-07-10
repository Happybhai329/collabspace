/**
 * src/models/Comment.model.js
 *
 * PURPOSE:
 * Threaded comments on tasks (and potentially other entities in the future).
 * Implements a two-level threading model (comment → replies).
 *
 * THREADING MODEL:
 * We use a parent field for one level of nesting (comment → reply).
 * WHY two-level only (not infinite):
 * - Infinite threading (Reddit-style) becomes complex to render and paginate
 * - Jira, Linear, and GitHub Issues all use flat or one-level threading
 * - A parent field is sufficient; deeper nesting can be added later if needed
 *
 * SOFT DELETE:
 * Comments are soft-deleted (isDeleted: true) instead of removed.
 * WHY: Deleted comment markers preserve thread context ("This comment was deleted").
 * Without them, replies become orphaned and confusing.
 *
 * MENTIONS:
 * Stores user IDs mentioned in the comment (via @username).
 * The service layer creates Notification records for each mentioned user.
 *
 * EDIT HISTORY:
 * Stores the previous version when a comment is edited.
 * Limited to last 10 edits (cap enforced in service layer).
 *
 * REACTIONS:
 * Emoji reactions as a subdocument array.
 * WHY embed vs separate collection: reactions are always queried with the comment,
 * are bounded in size, and update frequency is moderate.
 *
 * INDEXES:
 * - task: primary pattern — "get all comments for task X"
 * - parent: for threading — "get all replies to comment Y"
 */

import mongoose from 'mongoose';

const editHistorySchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    editedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, maxlength: 10 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Comment must belong to a task.'],
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      // Denormalized for permission checks
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment must have an author.'],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required.'],
      maxlength: [10000, 'Comment cannot exceed 10,000 characters.'],
      // Stores markdown text
    },
    // ── Threading ─────────────────────────────────────────────────────────
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      // null = top-level comment; ObjectId = reply to another comment
    },
    // ── Mentions ──────────────────────────────────────────────────────────
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // ── Reactions ─────────────────────────────────────────────────────────
    reactions: [reactionSchema],
    // ── Edit Tracking ──────────────────────────────────────────────────────
    isEdited: {
      type: Boolean,
      default: false,
    },
    editHistory: {
      type: [editHistorySchema],
      default: [],
      // Capped at 10 entries (enforced in service layer, not schema)
    },
    // ── Soft Delete ────────────────────────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // When deleted, redact content but preserve structure for threading
        if (ret.isDeleted) {
          ret.content = '[This comment was deleted]';
          ret.editHistory = [];
          ret.reactions = [];
        }
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
commentSchema.index({ task: 1, isDeleted: 1, createdAt: 1 });
commentSchema.index({ parent: 1 });
commentSchema.index({ author: 1, workspace: 1 });
commentSchema.index({ mentions: 1 }); // For "comments that mention me" feature

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
