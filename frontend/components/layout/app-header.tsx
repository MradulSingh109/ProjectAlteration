"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User, ShieldCheck, ChevronDown } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AppHeaderProps {
  onOpenMobileNav: () => void;
}

export function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    router.replace("/login");
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "REVIEWER":
        return "secondary";
      case "INSPECTOR":
      default:
        return "default";
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Left Area: Mobile Trigger & Brand Identity */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenMobileNav}
          className="h-9 w-9 md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            SIH26034
          </span>
        </div>

        <div className="hidden text-xs text-muted-foreground md:block">
          Legal Metrology Packaged Commodities Compliance System
        </div>
      </div>

      {/* Right Area: User Info & Menu */}
      <div className="relative" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => setIsUserMenuOpen((prev) => !prev)}
          className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isUserMenuOpen}
          aria-haspopup="menu"
          aria-label="User account menu"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
            {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
          </div>
          <div className="hidden text-left sm:block">
            <p className="font-medium text-foreground leading-none">
              {user?.name || "User"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {user?.email || ""}
            </p>
          </div>
          <Badge
            variant={getRoleBadgeVariant(user?.role)}
            className="hidden text-[10px] font-mono sm:inline-flex"
          >
            {user?.role || "USER"}
          </Badge>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              isUserMenuOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {/* User Dropdown Menu */}
        {isUserMenuOpen && (
          <div
            role="menu"
            aria-label="User options"
            className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            <div className="border-b border-border/80 pb-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs text-foreground truncate">
                  {user?.name}
                </span>
                <Badge
                  variant={getRoleBadgeVariant(user?.role)}
                  className="text-[10px] font-mono"
                >
                  {user?.role}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {user?.email}
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start gap-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                role="menuitem"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
