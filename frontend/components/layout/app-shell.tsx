"use client";

import * as React from "react";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { MobileNav } from "./mobile-nav";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Primary authenticated application shell.
 * Provides consistent desktop sidebar, top header, mobile drawer navigation,
 * and main view scroll container across all authenticated routes.
 */
export function AppShell({ children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop Sidebar */}
      <AppSidebar />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader onOpenMobileNav={() => setIsMobileNavOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-muted/10">
          {children}
        </main>
      </div>

      {/* Mobile Slide-Over Navigation */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </div>
  );
}
