export const Role = {
  ADMIN: "ADMIN",
  DRILLING_ENGINEER: "DRILLING_ENGINEER",
  GEOLOGIST: "GEOLOGIST",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = [
  Role.ADMIN,
  Role.DRILLING_ENGINEER,
  Role.GEOLOGIST,
  Role.VIEWER,
];

/**
 * Checks whether userRole satisfies requiredRole.
 * ADMIN has universal access across all role-protected features.
 */
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  if (userRole === Role.ADMIN) return true;
  return userRole === requiredRole;
}

/**
 * Checks whether userRole satisfies at least one role in allowedRoles list.
 * ADMIN has universal access.
 */
export function hasAnyRole(userRole: Role, allowedRoles: Role[]): boolean {
  if (userRole === Role.ADMIN) return true;
  return allowedRoles.includes(userRole);
}
