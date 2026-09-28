import { Role } from "./roles";

/**
 * Domain User entity representing an authenticated actor in the NWIS system.
 * Independent of ORM / persistence models.
 */
export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
