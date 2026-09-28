import { describe, it, expect } from "vitest";
import { verifyTelemetryApiKey } from "@/application/telemetry/telemetry-auth.guard";
import { config } from "@/config/env";
import { AppError } from "@/lib/errors";

describe("Telemetry Machine Authentication & Security Guard", () => {
  const validKey = config.telemetry.apiKey;

  it("authenticates machine requests using x-telemetry-api-key header", () => {
    const req = new Request("http://localhost:3000/api/v1/telemetry/readings", {
      method: "POST",
      headers: {
        "x-telemetry-api-key": validKey,
      },
    });

    expect(() => verifyTelemetryApiKey(req)).not.toThrow();
  });

  it("authenticates machine requests using Authorization Bearer header", () => {
    const req = new Request("http://localhost:3000/api/v1/telemetry/readings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
      },
    });

    expect(() => verifyTelemetryApiKey(req)).not.toThrow();
  });

  it("rejects machine request when api key is missing", () => {
    const req = new Request("http://localhost:3000/api/v1/telemetry/readings", {
      method: "POST",
      headers: {},
    });

    expect(() => verifyTelemetryApiKey(req)).toThrow(AppError);
    expect(() => verifyTelemetryApiKey(req)).toThrow(
      "Telemetry API key is required",
    );
  });

  it("rejects machine request with invalid api key (different length)", () => {
    const req = new Request("http://localhost:3000/api/v1/telemetry/readings", {
      method: "POST",
      headers: {
        "x-telemetry-api-key": "short_invalid_key",
      },
    });

    expect(() => verifyTelemetryApiKey(req)).toThrow(AppError);
    expect(() => verifyTelemetryApiKey(req)).toThrow(
      "Invalid telemetry API key",
    );
  });

  it("rejects machine request with invalid api key (same length, different chars)", () => {
    const modifiedKey =
      validKey.substring(0, validKey.length - 1) +
      (validKey.endsWith("a") ? "b" : "a");
    const req = new Request("http://localhost:3000/api/v1/telemetry/readings", {
      method: "POST",
      headers: {
        "x-telemetry-api-key": modifiedKey,
      },
    });

    expect(() => verifyTelemetryApiKey(req)).toThrow(AppError);
    expect(() => verifyTelemetryApiKey(req)).toThrow(
      "Invalid telemetry API key",
    );
  });

  it("does not leak secrets or keys in error details or messages", () => {
    const req = new Request("http://localhost:3000/api/v1/telemetry/readings", {
      method: "POST",
      headers: {
        "x-telemetry-api-key": "attacker_supplied_guess_key",
      },
    });

    try {
      verifyTelemetryApiKey(req);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.message).not.toContain(validKey);
      expect(appErr.statusCode).toBe(401);
    }
  });
});
