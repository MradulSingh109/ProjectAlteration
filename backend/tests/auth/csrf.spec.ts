import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { AppError } from "@/lib/errors";

describe("CSRF Protection Guard & Multi-Layer Defense", () => {
  it("allows safe HTTP methods (GET, HEAD, OPTIONS) without origin check", () => {
    const getReq = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
    });
    expect(() => verifyCsrf(getReq)).not.toThrow();

    const headReq = new NextRequest("http://localhost:3000/api/v1/health", {
      method: "HEAD",
    });
    expect(() => verifyCsrf(headReq)).not.toThrow();

    const optionsReq = new NextRequest(
      "http://localhost:3000/api/v1/auth/login",
      {
        method: "OPTIONS",
      },
    );
    expect(() => verifyCsrf(optionsReq)).not.toThrow();
  });

  it("allows mutating requests from matching local host origin", () => {
    const postReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(() => verifyCsrf(postReq)).not.toThrow();
  });

  it("allows mutating requests through reverse proxy via x-forwarded-host header", () => {
    const proxyReq = new NextRequest(
      "http://internal-docker-host:3000/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          host: "internal-docker-host:3000",
          "x-forwarded-host": "nwis.gov.in",
          origin: "https://nwis.gov.in",
        },
      },
    );
    expect(() => verifyCsrf(proxyReq)).not.toThrow();
  });

  it("allows mutating requests with valid referer when origin header is omitted", () => {
    const refererReq = new NextRequest(
      "http://localhost:3000/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          referer: "http://localhost:3000/login",
        },
      },
    );
    expect(() => verifyCsrf(refererReq)).not.toThrow();
  });

  it("rejects mutating requests with untrusted cross-origin with 403 FORBIDDEN", () => {
    const maliciousReq = new NextRequest(
      "http://localhost:3000/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          host: "nwis.gov.in",
          origin: "https://evil-attacker-site.com",
        },
      },
    );

    expect(() => verifyCsrf(maliciousReq)).toThrowError(AppError);
    try {
      verifyCsrf(maliciousReq);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(403);
      expect(appErr.code).toBe("FORBIDDEN");
      expect(appErr.message).toContain("Cross-origin request rejected");
    }
  });

  it("allows programmatic API requests with Bearer token and without Origin header", () => {
    const apiReq = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      method: "POST",
      headers: {
        authorization: "Bearer some_jwt_token",
      },
    });
    expect(() => verifyCsrf(apiReq)).not.toThrow();
  });
});
