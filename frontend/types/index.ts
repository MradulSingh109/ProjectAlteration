/**
 * Global frontend type definitions.
 * Domain types and API response models will be incrementally mapped from OpenAPI in later steps.
 */

export * from "@/lib/api/types";

export type NavItem = {
  title: string;
  href: string;
  disabled?: boolean;
  external?: boolean;
};
