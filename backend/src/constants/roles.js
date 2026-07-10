/**
 * src/constants/roles.js
 *
 * Role and permission definitions for the RBAC system.
 *
 * WHY define roles here instead of hardcoding strings:
 * - Single source of truth: change a role name in ONE place
 * - Role hierarchy is explicit and auditable
 * - Middleware imports these constants, preventing typo-based security bugs
 * - Enables future migration to a database-driven permission system
 *
 * Role Hierarchy (highest privilege → lowest):
 *   OWNER > ADMIN > MANAGER > DEVELOPER > VIEWER
 *
 * Role Semantics:
 * - OWNER:     Created the workspace. Cannot be removed. Can delete workspace.
 * - ADMIN:     Full CRUD on all resources. Can manage members (but not owner).
 * - MANAGER:   Can create/edit/delete projects and assign tasks. Cannot manage roles.
 * - DEVELOPER: Can create, update, and complete tasks assigned to them.
 * - VIEWER:    Read-only access. Cannot create or modify anything.
 */

export const ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
});

/**
 * Numeric privilege levels for hierarchy comparisons.
 * Higher number = more privilege.
 *
 * Usage:
 *   if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[ROLES.MANAGER]) { ... }
 */
export const ROLE_HIERARCHY = Object.freeze({
  [ROLES.VIEWER]: 1,
  [ROLES.DEVELOPER]: 2,
  [ROLES.MANAGER]: 3,
  [ROLES.ADMIN]: 4,
  [ROLES.OWNER]: 5,
});

/**
 * All valid role values as an array.
 * Used in Mongoose schema enum validation.
 */
export const ALL_ROLES = Object.values(ROLES);

/**
 * Roles that can modify workspace membership.
 */
export const MEMBER_MANAGEMENT_ROLES = [ROLES.OWNER, ROLES.ADMIN];

/**
 * Roles that can manage projects and boards.
 */
export const PROJECT_MANAGEMENT_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER];
