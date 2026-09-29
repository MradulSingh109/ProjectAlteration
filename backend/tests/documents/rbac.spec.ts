import { describe, it, expect } from "vitest";
import { Role } from "@/domain/auth/roles";
import { requireRole } from "@/application/auth/guard";
import { SafeUser } from "@/domain/auth/user.entity";

describe("Document Ingestion & Retrieval RBAC Authorization", () => {
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

  // Operational document upload roles
  const DOCUMENT_UPLOAD_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
  ];

  // Document read roles (metadata & binary retrieval)
  const DOCUMENT_READ_ROLES = [
    Role.ADMIN,
    Role.DRILLING_ENGINEER,
    Role.GEOLOGIST,
    Role.VIEWER,
  ];

  describe("Document Upload RBAC", () => {
    it("strictly prohibits VIEWER role from uploading drilling documents (403 FORBIDDEN)", () => {
      expect(() =>
        requireRole(viewerUser, ...DOCUMENT_UPLOAD_ROLES),
      ).toThrowError(/Access denied: Current role 'VIEWER' lacks permission/i);
    });

    it("permits DRILLING_ENGINEER role to upload drilling documents", () => {
      expect(() =>
        requireRole(drillingEngUser, ...DOCUMENT_UPLOAD_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to upload geological & drilling documents", () => {
      expect(() =>
        requireRole(geologistUser, ...DOCUMENT_UPLOAD_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role universal document upload permissions", () => {
      expect(() =>
        requireRole(adminUser, ...DOCUMENT_UPLOAD_ROLES),
      ).not.toThrow();
    });
  });

  describe("Document Metadata & Retrieval RBAC", () => {
    it("permits VIEWER role to access document metadata and retrieve binary files", () => {
      expect(() =>
        requireRole(viewerUser, ...DOCUMENT_READ_ROLES),
      ).not.toThrow();
    });

    it("permits DRILLING_ENGINEER role to read and retrieve documents", () => {
      expect(() =>
        requireRole(drillingEngUser, ...DOCUMENT_READ_ROLES),
      ).not.toThrow();
    });

    it("permits GEOLOGIST role to read and retrieve documents", () => {
      expect(() =>
        requireRole(geologistUser, ...DOCUMENT_READ_ROLES),
      ).not.toThrow();
    });

    it("permits ADMIN role to read and retrieve documents", () => {
      expect(() =>
        requireRole(adminUser, ...DOCUMENT_READ_ROLES),
      ).not.toThrow();
    });
  });
});
