import { describe, it, expect } from "vitest";
import {
  navigationItems,
  getNavItemsForRole,
} from "@/config/navigation";

describe("Navigation Configuration & Role Filtering", () => {
  it("defines all system modules with valid paths and icons", () => {
    expect(navigationItems.length).toBe(8);

    const hrefs = navigationItems.map((item) => item.href);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/inspections");
    expect(hrefs).toContain("/products");
    expect(hrefs).toContain("/declarations");
    expect(hrefs).toContain("/violations");
    expect(hrefs).toContain("/reviews");
    expect(hrefs).toContain("/reports");
    expect(hrefs).toContain("/admin");
  });

  describe("ADMIN Role Filtering", () => {
    it("permits ADMIN to see all navigation items including Reviews and Administration", () => {
      const adminItems = getNavItemsForRole("ADMIN");
      expect(adminItems.length).toBe(8);

      const hrefs = adminItems.map((item) => item.href);
      expect(hrefs).toContain("/reviews");
      expect(hrefs).toContain("/admin");
      expect(hrefs).toContain("/dashboard");
    });
  });

  describe("INSPECTOR Role Filtering", () => {
    it("permits INSPECTOR to see operational items while hiding Reviews and Administration", () => {
      const inspectorItems = getNavItemsForRole("INSPECTOR");
      expect(inspectorItems.length).toBe(6);

      const hrefs = inspectorItems.map((item) => item.href);
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/inspections");
      expect(hrefs).toContain("/products");
      expect(hrefs).toContain("/declarations");
      expect(hrefs).toContain("/violations");
      expect(hrefs).toContain("/reports");

      expect(hrefs).not.toContain("/reviews");
      expect(hrefs).not.toContain("/admin");
    });
  });

  describe("REVIEWER Role Filtering", () => {
    it("permits REVIEWER to see Reviews while hiding Administration", () => {
      const reviewerItems = getNavItemsForRole("REVIEWER");
      expect(reviewerItems.length).toBe(7);

      const hrefs = reviewerItems.map((item) => item.href);
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/inspections");
      expect(hrefs).toContain("/reviews");
      expect(hrefs).toContain("/reports");

      expect(hrefs).not.toContain("/admin");
    });
  });

  describe("Edge cases", () => {
    it("returns empty navigation list when role is missing or undefined", () => {
      expect(getNavItemsForRole(undefined)).toEqual([]);
      expect(getNavItemsForRole(null)).toEqual([]);
    });
  });
});
