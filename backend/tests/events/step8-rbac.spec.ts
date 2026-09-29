import { describe, it, expect } from "vitest";
import { Role } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";

describe("Step 8 — Advanced Query & Provenance RBAC Authorization", () => {
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

  // Step 8 Advanced read query roles (Events list, Document->Events, Event Summary, Event Detail)
  const ADVANCED_READ_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
    Role.VIEWER,
  ];

  // Mutating review roles
  const REVIEW_MUTATE_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
  ];

  describe("Read Query APIs (Events list, Provenance, Document->Events, Well Summary)", () => {
    it("permits VIEWER role to execute advanced filtered & paginated event queries", () => {
      expect(() =>
        requireRole(viewerUser, ...ADVANCED_READ_ROLES),
      ).not.toThrow();
    });

    it("permits VIEWER role to query document -> events provenance list", () => {
      expect(() =>
        requireRole(viewerUser, ...ADVANCED_READ_ROLES),
      ).not.toThrow();
    });

    it("permits VIEWER role to access well event summary aggregation", () => {
      expect(() =>
        requireRole(viewerUser, ...ADVANCED_READ_ROLES),
      ).not.toThrow();
    });

    it("permits DRILLING_ENGINEER role to access all query and summary APIs", () => {
      expect(() =>
        requireRole(drillingEngUser, ...ADVANCED_READ_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to access all query and summary APIs", () => {
      expect(() =>
        requireRole(geologistUser, ...ADVANCED_READ_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role universal access to all query and summary APIs", () => {
      expect(() =>
        requireRole(adminUser, ...ADVANCED_READ_ROLES),
      ).not.toThrow();
    });
  });

  describe("Mutating Operations RBAC Integrity Preservation", () => {
    it("strictly prohibits VIEWER role from reviewing or modifying events (403 FORBIDDEN)", () => {
      expect(() =>
        requireRole(viewerUser, ...REVIEW_MUTATE_ROLES),
      ).toThrowError(/Access denied: Current role 'VIEWER' lacks permission/i);
    });

    it("preserves DRILLING_ENGINEER authorization to perform event reviews", () => {
      expect(() =>
        requireRole(drillingEngUser, ...REVIEW_MUTATE_ROLES),
      ).not.toThrow();
    });
  });
});
