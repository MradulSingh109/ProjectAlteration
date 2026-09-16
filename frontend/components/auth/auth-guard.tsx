"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { UserRole } from "@/types/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * Route protection guard for authenticated pages.
 * Handles session verification, loading states, unauthenticated redirection,
 * and role-based access checks without flashing protected content.
 */
export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirectUrl = pathname
        ? `/login?redirect=${encodeURIComponent(pathname)}`
        : "/login";
      router.replace(redirectUrl);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-3"
      >
        <LoadingSpinner size="lg" />
        <p className="text-xs text-muted-foreground">
          Verifying security session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div
        role="alert"
        className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <h2 className="text-base font-semibold text-destructive">
          Access Restricted
        </h2>
        <p className="max-w-md text-xs text-muted-foreground">
          Your role ({user.role}) does not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
