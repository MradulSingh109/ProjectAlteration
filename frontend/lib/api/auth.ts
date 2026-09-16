import { apiClient } from "./client";
import {
  AuthResponse,
  AuthResponseData,
  AuthUser,
  CurrentUserResponse,
  LoginCredentials,
  LogoutResponse,
} from "@/types/auth";

/**
 * Authentication API Service Module
 *
 * Implements the verified SIH26034 backend authentication contract:
 * - POST /api/auth/login
 * - GET  /api/auth/me
 * - POST /api/auth/logout
 */

/**
 * Authenticates user credentials against the backend.
 *
 * @param credentials User email and password
 * @returns Sanitized user profile and JWT bearer token
 */
export async function loginApi(
  credentials: LoginCredentials
): Promise<AuthResponseData> {
  const response = await apiClient.post<AuthResponse>(
    "/auth/login",
    credentials
  );
  return response.data.data;
}

/**
 * Fetches the currently authenticated user's profile using the active Bearer token.
 *
 * @returns Current authenticated user entity
 */
export async function getCurrentUserApi(): Promise<AuthUser> {
  const response = await apiClient.get<CurrentUserResponse>("/auth/me");
  return response.data.data.user;
}

/**
 * Signals session logout to the backend server.
 *
 * @returns Status message indicating successful logout
 */
export async function logoutApi(): Promise<{ message: string }> {
  const response = await apiClient.post<LogoutResponse>("/auth/logout");
  return response.data.data;
}
