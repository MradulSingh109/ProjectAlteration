"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { getNavItemsForRole } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = React.useMemo(
    () => getNavItemsForRole(user?.role),
    [user?.role]
  );

  return (
    <aside
      className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-card/40"
      aria-label="Desktop Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-foreground tracking-tight">
            SIH26034
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            Legal Metrology
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          System Modules
        </div>
        <nav className="space-y-1" aria-label="Main Application Modules">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-hidden="true"
                  />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] py-0 px-1.5"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Role & Session Status Footer */}
      <div className="border-t border-border p-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              Current Role
            </span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {user?.role || "UNASSIGNED"}
            </Badge>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground truncate">
            {user?.name}
          </p>
        </div>
      </div>
    </aside>
  );
}
