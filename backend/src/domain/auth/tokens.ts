import { Role } from "./roles";

/**
 * Access JWT payload specification.
 * Contains only minimal non-sensitive identity claims.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  sessionId: string;
  iat?: number;
  exp?: number;
}
