import { ApiResponse } from "@/lib/api/types";

/**
 * Valid user roles defined by the backend RBAC matrix.
 */
export type UserRole = "ADMIN" | "INSPECTOR" | "REVIEWER";

/**
 * Sanitized user entity returned by the backend authentication service.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Credentials payload for POST /api/auth/login
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Response payload structure inside the data field of POST /api/auth/login
 */
export interface AuthResponseData {
  user: AuthUser;
  token: string;
}

/**
 * API response envelopes matching backend contract
 */
export type AuthResponse = ApiResponse<AuthResponseData>;
export type CurrentUserResponse = ApiResponse<{ user: AuthUser }>;
export type LogoutResponse = ApiResponse<{ message: string }>;
