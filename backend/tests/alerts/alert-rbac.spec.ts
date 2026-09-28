import { describe, it, expect } from "vitest";
import { Role } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";

describe("Step 11 — Alert Engine RBAC Authorization", () => {
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

  const OPERATIONAL_ALERT_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
  ];

  const VIEW_ALERT_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
    Role.VIEWER,
  ];

  describe("Alert Operational Mutation Endpoints (Evaluate, Acknowledge, Resolve)", () => {
    it("permits DRILLING_ENGINEER role to perform operational alert mutations", () => {
      expect(() =>
        requireRole(drillingEngUser, ...OPERATIONAL_ALERT_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to perform operational alert mutations", () => {
      expect(() =>
        requireRole(geologistUser, ...OPERATIONAL_ALERT_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role to perform operational alert mutations", () => {
      expect(() =>
        requireRole(adminUser, ...OPERATIONAL_ALERT_ROLES),
      ).not.toThrow();
    });

    it("strictly forbids VIEWER role from evaluating or mutating alerts", () => {
      expect(() => requireRole(viewerUser, ...OPERATIONAL_ALERT_ROLES)).toThrow(
        /Access denied/i,
      );
    });

    it("denies access to unknown or guest roles", () => {
      const guestUser: SafeUser = {
        id: "user-guest",
        email: "guest@external.com",
        role: "GUEST" as any,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => requireRole(guestUser, ...OPERATIONAL_ALERT_ROLES)).toThrow(
        /Access denied/i,
      );
    });
  });

  describe("Alert Read / Retrieval Endpoints", () => {
    it("permits VIEWER role to view and filter alerts", () => {
      expect(() => requireRole(viewerUser, ...VIEW_ALERT_ROLES)).not.toThrow();
    });

    it("permits DRILLING_ENGINEER role to view alerts", () => {
      expect(() =>
        requireRole(drillingEngUser, ...VIEW_ALERT_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to view alerts", () => {
      expect(() =>
        requireRole(geologistUser, ...VIEW_ALERT_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role to view alerts", () => {
      expect(() => requireRole(adminUser, ...VIEW_ALERT_ROLES)).not.toThrow();
    });
  });
});
