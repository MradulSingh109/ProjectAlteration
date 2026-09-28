import { describe, it, expect, vi } from "vitest";
import { Role } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";
import { AppError } from "@/lib/errors";

describe("Well & Formation RBAC Authorization Rules", () => {
  const viewerUser: SafeUser = {
    id: "user-viewer-1",
    email: "viewer@nwis.gov.in",
    role: Role.VIEWER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const drillingEngUser: SafeUser = {
    id: "user-drill-1",
    email: "drilling.eng@nwis.gov.in",
    role: Role.DRILLING_ENGINEER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const geologistUser: SafeUser = {
    id: "user-geo-1",
    email: "geologist@nwis.gov.in",
    role: Role.GEOLOGIST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser: SafeUser = {
    id: "user-admin-1",
    email: "admin@nwis.gov.in",
    role: Role.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Operational write roles defined in Step 5 specification
  const OPERATIONAL_WRITE_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
  ];

  // Read roles: All authenticated roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST, VIEWER)
  const OPERATIONAL_READ_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
    Role.VIEWER,
  ];

  describe("Read Access Verification", () => {
    it("allows VIEWER role to read wells and formations", () => {
      expect(() =>
        requireRole(viewerUser, ...OPERATIONAL_READ_ROLES),
      ).not.toThrow();
    });

    it("allows DRILLING_ENGINEER role to read wells and formations", () => {
      expect(() =>
        requireRole(drillingEngUser, ...OPERATIONAL_READ_ROLES),
      ).not.toThrow();
    });

    it("allows GEOLOGIST role to read wells and formations", () => {
      expect(() =>
        requireRole(geologistUser, ...OPERATIONAL_READ_ROLES),
      ).not.toThrow();
    });

    it("allows ADMIN role to read wells and formations", () => {
      expect(() =>
        requireRole(adminUser, ...OPERATIONAL_READ_ROLES),
      ).not.toThrow();
    });
  });

  describe("Write / Mutation Access Restrictions", () => {
    it("forbids VIEWER role from creating or modifying well master records", () => {
      try {
        requireRole(viewerUser, ...OPERATIONAL_WRITE_ROLES);
        expect.unreachable("VIEWER should have been denied mutation access");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.code).toBe("FORBIDDEN");
        expect(appErr.message).toContain("lacks permission");
      }
    });

    it("forbids VIEWER role from creating or modifying formation stratigraphy records", () => {
      try {
        requireRole(viewerUser, ...OPERATIONAL_WRITE_ROLES);
        expect.unreachable("VIEWER should have been denied formation mutation");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.code).toBe("FORBIDDEN");
      }
    });

    it("allows DRILLING_ENGINEER role to perform mutations", () => {
      expect(() =>
        requireRole(drillingEngUser, ...OPERATIONAL_WRITE_ROLES),
      ).not.toThrow();
    });

    it("allows GEOLOGIST role to perform mutations", () => {
      expect(() =>
        requireRole(geologistUser, ...OPERATIONAL_WRITE_ROLES),
      ).not.toThrow();
    });

    it("allows ADMIN role to perform mutations", () => {
      expect(() =>
        requireRole(adminUser, ...OPERATIONAL_WRITE_ROLES),
      ).not.toThrow();
    });
  });
});
