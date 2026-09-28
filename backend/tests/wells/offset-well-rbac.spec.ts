import { describe, it, expect } from "vitest";
import { Role } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";

describe("Step 9 — Offset Well Intelligence RBAC Authorization", () => {
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

  // Step 9 Offset Well Intelligence query roles (all authenticated roles)
  const OFFSET_INTELLIGENCE_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
    Role.VIEWER,
  ];

  describe("Offset Well Intelligence Query API", () => {
    it("permits VIEWER role to query offset wells intelligence", () => {
      expect(() =>
        requireRole(viewerUser, ...OFFSET_INTELLIGENCE_ROLES),
      ).not.toThrow();
    });

    it("permits DRILLING_ENGINEER role to query offset wells intelligence", () => {
      expect(() =>
        requireRole(drillingEngUser, ...OFFSET_INTELLIGENCE_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to query offset wells intelligence", () => {
      expect(() =>
        requireRole(geologistUser, ...OFFSET_INTELLIGENCE_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role to query offset wells intelligence", () => {
      expect(() =>
        requireRole(adminUser, ...OFFSET_INTELLIGENCE_ROLES),
      ).not.toThrow();
    });

    it("denies access when user role is unknown or unauthorized", () => {
      const unauthorizedUser: SafeUser = {
        id: "unauth-user",
        email: "unknown@evil.com",
        role: "UNAUTHORIZED_GUEST" as any,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() =>
        requireRole(unauthorizedUser, ...OFFSET_INTELLIGENCE_ROLES),
      ).toThrow(/Access denied/i);
    });
  });
});
