"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, X, LogOut } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { getNavItemsForRole } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const navItems = React.useMemo(
    () => getNavItemsForRole(user?.role),
    [user?.role]
  );

  // Close on Escape key press
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scrolling when mobile drawer is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace("/login");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
      className="fixed inset-0 z-50 flex md:hidden animate-in fade-in-0 duration-200"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative flex w-full max-w-xs flex-1 flex-col bg-background shadow-xl border-r border-border animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground">SIH26034</span>
              <span className="text-[10px] text-muted-foreground uppercase">
                Legal Metrology
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            System Modules
          </div>
          <nav className="space-y-1" aria-label="Mobile Application Modules">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href + "/"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="outline" className="text-[10px]">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Summary & Sign Out */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground truncate">
                {user?.name}
              </span>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {user?.role}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-center gap-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
