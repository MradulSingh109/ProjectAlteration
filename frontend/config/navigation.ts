import {
  LayoutDashboard,
  ClipboardList,
  Package,
  FileCheck2,
  AlertTriangle,
  FileSearch,
  FileBarChart,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@/types/auth";

export interface NavItemConfig {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  allowedRoles: UserRole[];
  badge?: string;
  disabled?: boolean;
}

/**
 * Centralized navigation configuration for the SIH26034 compliance checking system.
 *
 * Role Matrix Mapping (Backend-Aligned):
 * - ADMIN: Access to all system areas (Dashboard, Inspections, Products, Declarations,
 *   Violations, Reviews, Reports, and Administration).
 * - INSPECTOR: Field operations and inspection creation/management (Dashboard,
 *   Inspections, Products, Declarations, Violations, Reports).
 * - REVIEWER: Adjudication and legal compliance verification (Dashboard, Inspections,
 *   Products, Declarations, Violations, Reviews, Reports).
 */
export const navigationItems: NavItemConfig[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "System overview and inspection metrics",
    allowedRoles: ["ADMIN", "INSPECTOR", "REVIEWER"],
  },
  {
    title: "Inspections",
    href: "/inspections",
    icon: ClipboardList,
    description: "Commodity packaging inspection records",
    allowedRoles: ["ADMIN", "INSPECTOR", "REVIEWER"],
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    description: "Commodity catalog and registered brands",
    allowedRoles: ["ADMIN", "INSPECTOR", "REVIEWER"],
  },
  {
    title: "Declarations",
    href: "/declarations",
    icon: FileCheck2,
    description: "Mandatory packaged commodity declarations",
    allowedRoles: ["ADMIN", "INSPECTOR", "REVIEWER"],
  },
  {
    title: "Violations",
    href: "/violations",
    icon: AlertTriangle,
    description: "Detected Legal Metrology rule non-compliances",
    allowedRoles: ["ADMIN", "INSPECTOR", "REVIEWER"],
  },
  {
    title: "Reviews",
    href: "/reviews",
    icon: FileSearch,
    description: "Human reviewer verification and adjudication",
    allowedRoles: ["ADMIN", "REVIEWER"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileBarChart,
    description: "Compliance audit reports and documentation",
    allowedRoles: ["ADMIN", "INSPECTOR", "REVIEWER"],
  },
  {
    title: "Administration",
    href: "/admin",
    icon: Settings,
    description: "User management and system configuration",
    allowedRoles: ["ADMIN"],
  },
];

/**
 * Filters the centralized navigation items based on the user's role.
 *
 * @param role The authenticated user's role code
 * @returns Array of navigation items permitted for the role
 */
export function getNavItemsForRole(role?: UserRole | null): NavItemConfig[] {
  if (!role) return [];
  return navigationItems.filter((item) => item.allowedRoles.includes(role));
}
