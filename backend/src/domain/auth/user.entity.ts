import { Role } from "./roles";

/**
 * Safe client-facing user model excluding password hash, tokens, or private credentials.
 */
export interface SafeUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toSafeUser(user: {
  id: string;
  email: string;
  role: Role | string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
