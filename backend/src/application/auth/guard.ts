import { NextRequest } from "next/server";
import { getAccessTokenFromRequest } from "@/infrastructure/auth/cookie.helper";
import { jwtService } from "@/infrastructure/auth/jwt.service";
import { authService } from "./auth.service";
import { Role, hasAnyRole } from "@/domain/auth/roles";
import { SafeUser } from "@/domain/auth/user.entity";
import { AccessTokenPayload } from "@/domain/auth/tokens";
import { AppError } from "@/lib/errors";

export interface AuthenticatedContext {
  user: SafeUser;
  sessionId: string;
  tokenPayload: AccessTokenPayload;
}

/**
 * Reusable authentication guard for API route handlers.
 * Extracts credentials from HTTP-only cookie or Bearer token, verifies JWT signature
 * and validates active database session status (including revocation check).
 *
 * @throws AppError 401 UNAUTHORIZED / SESSION_EXPIRED / INVALID_TOKEN
 */
export async function authenticateRequest(
  req: NextRequest,
): Promise<AuthenticatedContext> {
  const token = getAccessTokenFromRequest(req);

  if (!token) {
    throw AppError.unauthorized("Authentication required", "UNAUTHORIZED");
  }

  // 1. Cryptographically verify JWT signature and claims
  const tokenPayload = await jwtService.verifyAccessToken(token);

  // 2. Validate session in DB to enforce instant revocation and user active state
  const user = await authService.validateSession(tokenPayload.sessionId);

  return {
    user,
    sessionId: tokenPayload.sessionId,
    tokenPayload,
  };
}

/**
 * Reusable RBAC role authorization guard.
 * Validates that authenticated user possesses one of the allowed roles.
 * Note: ADMIN role always satisfies all role requirements via domain logic.
 *
 * @throws AppError 403 FORBIDDEN
 */
export function requireRole(user: SafeUser, ...allowedRoles: Role[]): void {
  if (allowedRoles.length === 0) {
    return;
  }

  if (!hasAnyRole(user.role, allowedRoles)) {
    throw AppError.forbidden(
      `Access denied: Current role '${user.role}' lacks permission for this resource`,
    );
  }
}

/**
 * Combined authentication and authorization guard.
 * Authenticates request and immediately verifies required roles.
 *
 * Usage in route handlers:
 * ```ts
 * const { user } = await requireAuth(req, Role.ADMIN, Role.DRILLING_ENGINEER);
 * ```
 */
export async function requireAuth(
  req: NextRequest,
  ...allowedRoles: Role[]
): Promise<AuthenticatedContext> {
  const context = await authenticateRequest(req);

  if (allowedRoles.length > 0) {
    requireRole(context.user, ...allowedRoles);
  }

  return context;
}
