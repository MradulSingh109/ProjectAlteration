"use client";

import * as React from "react";
import { AuthResponseData, AuthUser } from "@/types/auth";
import { tokenStorage } from "@/lib/auth/token-storage";
import { getCurrentUserApi, logoutApi } from "@/lib/api/auth";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: AuthResponseData) => void;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Initialize session from storage and verify with backend
  React.useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      const storedToken = tokenStorage.getToken();
      const storedUser = tokenStorage.getStoredUser();

      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsLoading(false);
        }
        return;
      }

      // Optimistically restore session
      if (isMounted) {
        setToken(storedToken);
        if (storedUser) {
          setUser(storedUser);
        }
      }

      // Verify token validity against backend /auth/me
      try {
        const verifiedUser = await getCurrentUserApi();
        if (isMounted) {
          setUser(verifiedUser);
          tokenStorage.setStoredUser(verifiedUser);
        }
      } catch {
        // If verification fails (e.g. token expired, account disabled), clear stale state
        if (isMounted) {
          tokenStorage.clearSession();
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeSession();

    // Listen for session expiration events dispatched by API client
    const handleSessionExpired = () => {
      if (isMounted) {
        tokenStorage.clearSession();
        setUser(null);
        setToken(null);
        setIsLoading(false);
      }
    };

    window.addEventListener("sih:session-expired", handleSessionExpired);

    return () => {
      isMounted = false;
      window.removeEventListener("sih:session-expired", handleSessionExpired);
    };
  }, []);

  const login = React.useCallback((data: AuthResponseData) => {
    tokenStorage.setToken(data.token);
    tokenStorage.setStoredUser(data.user);
    setToken(data.token);
    setUser(data.user);
    setIsLoading(false);
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Backend logout is stateless; local session clearing takes priority
    } finally {
      tokenStorage.clearSession();
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value = React.useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
