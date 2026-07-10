/**
 * src/constants/enums.js
 *
 * Shared enumeration values used across models and business logic.
 *
 * WHY centralize enums:
 * - Models and services reference the same values, not duplicated strings
 * - When a value changes (e.g., 'todo' → 'backlog'), only this file changes
 * - Keeps Mongoose schema files clean and focused on structure, not data
 */

// ── Task Status ───────────────────────────────────────────────────────────────
export const TASK_STATUS = Object.freeze({
  BACKLOG: 'backlog',
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
  CANCELLED: 'cancelled',
});

// ── Task Priority ─────────────────────────────────────────────────────────────
export const TASK_PRIORITY = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
});

// ── Task Type ─────────────────────────────────────────────────────────────────
export const TASK_TYPE = Object.freeze({
  STORY: 'story',
  BUG: 'bug',
  TASK: 'task',
  EPIC: 'epic',
  SUBTASK: 'subtask',
});

// ── Board Type ────────────────────────────────────────────────────────────────
export const BOARD_TYPE = Object.freeze({
  KANBAN: 'kanban',
  SCRUM: 'scrum',
});

// ── Notification Type ─────────────────────────────────────────────────────────
export const NOTIFICATION_TYPE = Object.freeze({
  TASK_ASSIGNED: 'task_assigned',
  TASK_UPDATED: 'task_updated',
  COMMENT_ADDED: 'comment_added',
  MENTIONED: 'mentioned',
  WORKSPACE_INVITE: 'workspace_invite',
  WORKSPACE_ROLE_CHANGED: 'workspace_role_changed',
  PROJECT_CREATED: 'project_created',
  DEADLINE_APPROACHING: 'deadline_approaching',
});

// ── Activity Action Types ─────────────────────────────────────────────────────
export const ACTIVITY_ACTION = Object.freeze({
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  MOVED: 'moved',
  ASSIGNED: 'assigned',
  UNASSIGNED: 'unassigned',
  COMMENTED: 'commented',
  STATUS_CHANGED: 'status_changed',
  PRIORITY_CHANGED: 'priority_changed',
  MEMBER_ADDED: 'member_added',
  MEMBER_REMOVED: 'member_removed',
});

// ── Entity Types (for polymorphic ActivityLog) ────────────────────────────────
export const ENTITY_TYPE = Object.freeze({
  TASK: 'Task',
  PROJECT: 'Project',
  BOARD: 'Board',
  WORKSPACE: 'Workspace',
  COMMENT: 'Comment',
});

// ── Project Status ────────────────────────────────────────────────────────────
export const PROJECT_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  COMPLETED: 'completed',
});
