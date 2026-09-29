import { describe, it, expect } from "vitest";
import { Role } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";

describe("Drilling Events & Human Review RBAC Authorization", () => {
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

  // Operational event creation & human review roles
  const EVENT_REVIEW_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
  ];

  // Event read roles (listing & event detail with provenance)
  const EVENT_READ_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
    Role.VIEWER,
  ];

  describe("Event Creation & Human Review RBAC (APPROVE, EDIT, INVALIDATE)", () => {
    it("strictly prohibits VIEWER role from reviewing or creating events (403 FORBIDDEN)", () => {
      expect(() => requireRole(viewerUser, ...EVENT_REVIEW_ROLES)).toThrowError(
        /Access denied: Current role 'VIEWER' lacks permission/i,
      );
    });

    it("permits DRILLING_ENGINEER role to submit candidates and review events", () => {
      expect(() =>
        requireRole(drillingEngUser, ...EVENT_REVIEW_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to submit candidates and review events", () => {
      expect(() =>
        requireRole(geologistUser, ...EVENT_REVIEW_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role universal event creation and review authorization", () => {
      expect(() => requireRole(adminUser, ...EVENT_REVIEW_ROLES)).not.toThrow();
    });
  });

  describe("Event Read & Provenance Inspection RBAC", () => {
    it("permits VIEWER role to list events and inspect event detail provenance", () => {
      expect(() => requireRole(viewerUser, ...EVENT_READ_ROLES)).not.toThrow();
    });

    it("permits DRILLING_ENGINEER role to read and inspect events", () => {
      expect(() =>
        requireRole(drillingEngUser, ...EVENT_READ_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to read and inspect events", () => {
      expect(() =>
        requireRole(geologistUser, ...EVENT_READ_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role to read and inspect events", () => {
      expect(() => requireRole(adminUser, ...EVENT_READ_ROLES)).not.toThrow();
    });
  });
});
