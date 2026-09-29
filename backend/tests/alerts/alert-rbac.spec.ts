import { describe, it, expect } from "vitest";
import { Role } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";
import { evaluateRangeSchema } from "@/application/alerts/alert.dto";

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

  describe("Range Evaluation Schema Validation", () => {
    it("accepts a valid bounded evaluation range with explicit limits", () => {
      const parsed = evaluateRangeSchema.safeParse({
        from: "2026-09-28T00:00:00.000Z",
        to: "2026-09-28T12:00:00.000Z",
        limit: 50,
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.limit).toBe(50);
        expect(parsed.data.from).toBeInstanceOf(Date);
        expect(parsed.data.to).toBeInstanceOf(Date);
      }
    });

    it("rejects when from is missing", () => {
      const parsed = evaluateRangeSchema.safeParse({
        to: "2026-09-28T12:00:00.000Z",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects when to is missing", () => {
      const parsed = evaluateRangeSchema.safeParse({
        from: "2026-09-28T00:00:00.000Z",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects when from date is after to date", () => {
      const parsed = evaluateRangeSchema.safeParse({
        from: "2026-09-28T12:00:00.000Z",
        to: "2026-09-28T00:00:00.000Z",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain(
          "from date must be earlier than or equal to to date",
        );
      }
    });

    it("accepts exact 24-hour evaluation window", () => {
      const parsed = evaluateRangeSchema.safeParse({
        from: "2026-09-28T00:00:00.000Z",
        to: "2026-09-29T00:00:00.000Z",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects evaluation window exceeding 24 hours", () => {
      const parsed = evaluateRangeSchema.safeParse({
        from: "2026-09-28T00:00:00.000Z",
        to: "2026-09-29T00:00:01.000Z",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain(
          "Evaluation window cannot exceed 24 hours",
        );
      }
    });

    it("rejects limit greater than 100", () => {
      const parsed = evaluateRangeSchema.safeParse({
        from: "2026-09-28T00:00:00.000Z",
        to: "2026-09-28T04:00:00.000Z",
        limit: 101,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain(
          "limit cannot exceed 100",
        );
      }
    });
  });
});
