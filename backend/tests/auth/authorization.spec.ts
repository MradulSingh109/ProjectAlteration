import { describe, it, expect, vi } from "vitest";
import { Role, hasRole, hasAnyRole } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";
import { AppError } from "@/lib/errors";

describe("RBAC & Role-Based Authorization", () => {
  const viewerUser: SafeUser = {
    id: "uuid-1",
    email: "viewer@nwis.gov.in",
    role: Role.VIEWER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const geologistUser: SafeUser = {
    id: "uuid-2",
    email: "geo@nwis.gov.in",
    role: Role.GEOLOGIST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const drillingEngUser: SafeUser = {
    id: "uuid-3",
    email: "drilling@nwis.gov.in",
    role: Role.DRILLING_ENGINEER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser: SafeUser = {
    id: "uuid-4",
    email: "admin@nwis.gov.in",
    role: Role.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("Domain Role Checks (hasRole & hasAnyRole)", () => {
    it("allows user with matching role", () => {
      expect(hasRole(Role.GEOLOGIST, Role.GEOLOGIST)).toBe(true);
      expect(hasRole(Role.DRILLING_ENGINEER, Role.DRILLING_ENGINEER)).toBe(
        true,
      );
      expect(hasRole(Role.VIEWER, Role.VIEWER)).toBe(true);
    });

    it("denies user without matching role", () => {
      expect(hasRole(Role.VIEWER, Role.GEOLOGIST)).toBe(false);
      expect(hasRole(Role.GEOLOGIST, Role.DRILLING_ENGINEER)).toBe(false);
      expect(hasRole(Role.DRILLING_ENGINEER, Role.ADMIN)).toBe(false);
    });

    it("grants ADMIN role access to all required roles", () => {
      expect(hasRole(Role.ADMIN, Role.VIEWER)).toBe(true);
      expect(hasRole(Role.ADMIN, Role.GEOLOGIST)).toBe(true);
      expect(hasRole(Role.ADMIN, Role.DRILLING_ENGINEER)).toBe(true);
      expect(hasRole(Role.ADMIN, Role.ADMIN)).toBe(true);
    });

    it("verifies hasAnyRole across role lists", () => {
      const fieldRoles = [Role.DRILLING_ENGINEER, Role.GEOLOGIST];
      expect(hasAnyRole(Role.DRILLING_ENGINEER, fieldRoles)).toBe(true);
      expect(hasAnyRole(Role.GEOLOGIST, fieldRoles)).toBe(true);
      expect(hasAnyRole(Role.VIEWER, fieldRoles)).toBe(false);
      expect(hasAnyRole(Role.ADMIN, fieldRoles)).toBe(true);
    });
  });

  describe("Guard requireRole", () => {
    it("permits authorized role without throwing", () => {
      expect(() => requireRole(geologistUser, Role.GEOLOGIST)).not.toThrow();
      expect(() =>
        requireRole(drillingEngUser, Role.DRILLING_ENGINEER),
      ).not.toThrow();
      expect(() => requireRole(viewerUser, Role.VIEWER)).not.toThrow();
    });

    it("permits ADMIN user on any restricted role", () => {
      expect(() => requireRole(adminUser, Role.GEOLOGIST)).not.toThrow();
      expect(() =>
        requireRole(adminUser, Role.DRILLING_ENGINEER),
      ).not.toThrow();
    });

    it("throws 403 FORBIDDEN AppError when role is unauthorized", () => {
      try {
        requireRole(viewerUser, Role.DRILLING_ENGINEER, Role.ADMIN);
        expect.unreachable("Should have thrown 403 FORBIDDEN");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.code).toBe("FORBIDDEN");
        expect(appErr.message).toContain("lacks permission");
      }
    });
  });
});
