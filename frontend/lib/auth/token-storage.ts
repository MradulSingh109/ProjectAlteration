import { AuthUser } from "@/types/auth";

/**
 * Token and Session Storage Manager
 *
 * Security Architecture & Trade-Off Documentation:
 * ------------------------------------------------
 * 1. Bearer Token Contract:
 *    The SIH26034 backend is an independent Express REST API utilizing Bearer JWT
 *    authentication via HTTP `Authorization: Bearer <token>` headers rather than
 *    server-set HttpOnly session cookies.
 *
 * 2. LocalStorage & XSS Implications:
 *    Tokens are retained in browser localStorage (with an automatic in-memory fallback
 *    for SSR or when localStorage is unavailable/restricted).
 *    Because localStorage is accessible to JavaScript within the origin, Cross-Site
 *    Scripting (XSS) prevention is critical. Strict input validation, DOM sanitization,
 *    and Content Security Policies (CSP) must be enforced across all components.
 *
 * 3. Centralized Token Management:
 *    All token retrieval, storage, and clearance operations are strictly centralized
 *    through this tokenStorage module. No raw localStorage keys are accessed elsewhere.
 *
 * 4. Zero Sensitive Credential Exposure:
 *    - Passwords are NEVER stored in localStorage, memory caches, or anywhere on the client.
 *    - Tokens and passwords are NEVER logged to console, external loggers, or telemetry.
 *    - Tokens are NEVER included in URLs, query strings, or rendered into the UI.
 *
 * 5. Authoritative Authorization:
 *    Client-side role information is strictly for UI/UX rendering (e.g. navigation state).
 *    The backend remains the authoritative enforcement layer for all authorization decisions.
 *
 * 6. Refresh Token Status & Expiration:
 *    The backend contract does not provide or support refresh tokens. Tokens have a finite
 *    lifetime governed by backend configuration (default 1 day).
 *
 * 7. Session Invalidation on 401:
 *    Any 401 Unauthorized or TokenExpired response from the backend triggers immediate
 *    session clearance through this module, avoiding redirect loops and ensuring expired
 *    sessions are promptly terminated.
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
