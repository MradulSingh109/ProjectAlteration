import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { AppError } from "@/lib/errors";

describe("CSRF Protection Guard", () => {
  it("allows safe HTTP methods (GET, HEAD, OPTIONS) without origin check", () => {
    const getReq = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
    });
    expect(() => verifyCsrf(getReq)).not.toThrow();

    const headReq = new NextRequest("http://localhost:3000/api/v1/health", {
      method: "HEAD",
    });
    expect(() => verifyCsrf(headReq)).not.toThrow();
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

  it("rejects mutating request with malicious cross-origin", () => {
    const maliciousReq = new NextRequest(
      "http://localhost:3000/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          host: "production-nwis.gov.in",
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
