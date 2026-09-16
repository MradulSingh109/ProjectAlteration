import { AuthUser } from "@/types/auth";

/**
 * Token and Session Storage Manager
 *
 * Security Architecture & Trade-Off Documentation:
 * ------------------------------------------------
 * The SIH26034 backend is an independent Express REST API utilizing Bearer JWT
 * authentication via standard HTTP `Authorization: Bearer <token>` headers rather than
 * server-set HttpOnly session cookies.
 *
 * In this client-side architecture, tokens are retained in browser localStorage
 * with an automatic in-memory fallback when localStorage is unavailable (e.g., during
 * Server-Side Rendering (SSR), or when blocked by strict browser privacy settings).
 *
 * Trade-Off:
 * - LocalStorage is resilient to tab reloads and enables seamless client-side authentication.
 * - However, items in LocalStorage can theoretically be accessed by malicious scripts if an
 *   XSS vulnerability exists. Therefore, strict input validation, DOM sanitization, and
 *   Content Security Policies must be enforced across all components.
 * - Sensitive credentials (passwords) and server secrets are NEVER persisted or logged.
 */

const TOKEN_KEY = "sih26034_auth_token";
const USER_KEY = "sih26034_auth_user";

// In-memory fallback for SSR and restricted storage environments
let memoryToken: string | null = null;
let memoryUser: AuthUser | null = null;

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export const tokenStorage = {
  getToken(): string | null {
    if (isLocalStorageAvailable()) {
      return window.localStorage.getItem(TOKEN_KEY);
    }
    return memoryToken;
  },

  setToken(token: string): void {
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
    memoryToken = token;
  },

  clearToken(): void {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(TOKEN_KEY);
    }
    memoryToken = null;
  },

  getStoredUser(): AuthUser | null {
    if (isLocalStorageAvailable()) {
      const raw = window.localStorage.getItem(USER_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as AuthUser;
      } catch {
        window.localStorage.removeItem(USER_KEY);
        return null;
      }
    }
    return memoryUser;
  },

  setStoredUser(user: AuthUser): void {
    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {
        // Fallback silently to memory if storage quota exceeded
      }
    }
    memoryUser = user;
  },

  clearStoredUser(): void {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(USER_KEY);
    }
    memoryUser = null;
  },

  clearSession(): void {
    this.clearToken();
    this.clearStoredUser();
  },
};
