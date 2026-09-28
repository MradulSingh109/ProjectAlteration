import { describe, it, expect } from "vitest";
import {
  ingestTelemetrySchema,
  queryTelemetrySchema,
} from "@/application/telemetry/telemetry.dto";

describe("Telemetry Validation & Canonical Schema", () => {
  const validPayload = {
    wellId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    sourceId: "RIG-ALPHA-01",
    sequenceNumber: 1001,
    timestamp: "2026-09-28T12:00:00.000Z",
    measurements: {
      depthMd: 2500.5,
      depthTvd: 2480.2,
      rateOfPenetration: 18.5,
      hookLoad: 220.4,
      standpipePressure: 3200.0,
      annularPressure: 150.0,
      surfaceTorque: 14500.0,
      rotaryRpm: 120.0,
      flowRateIn: 650.0,
      flowRateOut: 645.0,
      mudDensity: 11.2,
    },
    metadata: {
      bitModel: "PDC-8.5",
      formationLithology: "Sandstone",
    },
  };

  it("successfully parses a valid canonical telemetry payload", () => {
    const result = ingestTelemetrySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wellId).toBe("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
      expect(result.data.sequenceNumber).toBe(1001);
      expect(result.data.timestamp).toBeInstanceOf(Date);
      expect(result.data.measurements.depthMd).toBe(2500.5);
    }
  });

  it("accepts sequence number as string integer and transforms it", () => {
    const payload = {
      ...validPayload,
      sequenceNumber: "1002",
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sequenceNumber).toBe(1002);
    }
  });

  it("rejects non-integer sequence numbers", () => {
    const payload = {
      ...validPayload,
      sequenceNumber: 1002.5,
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects negative sequence numbers", () => {
    const payload = {
      ...validPayload,
      sequenceNumber: -5,
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects invalid wellId non-UUID", () => {
    const payload = {
      ...validPayload,
      wellId: "invalid-uuid-string",
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("valid UUID");
    }
  });

  it("rejects empty sourceId", () => {
    const payload = {
      ...validPayload,
      sourceId: "   ",
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects malformed timestamps", () => {
    const payload = {
      ...validPayload,
      timestamp: "not-a-timestamp",
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects NaN in numeric measurements", () => {
    const payload = {
      ...validPayload,
      measurements: {
        ...validPayload.measurements,
        depthMd: NaN,
      },
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects Infinity in numeric measurements", () => {
    const payload = {
      ...validPayload,
      measurements: {
        ...validPayload.measurements,
        standpipePressure: Infinity,
      },
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects -Infinity in numeric measurements", () => {
    const payload = {
      ...validPayload,
      measurements: {
        ...validPayload.measurements,
        hookLoad: -Infinity,
      },
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects negative measurement values where physical range is non-negative", () => {
    const payload = {
      ...validPayload,
      measurements: {
        ...validPayload.measurements,
        depthMd: -100,
      },
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects oversized metadata payloads (>64KB)", () => {
    const largeString = "x".repeat(70000);
    const payload = {
      ...validPayload,
      metadata: {
        bloat: largeString,
      },
    };
    const result = ingestTelemetrySchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "exceeds maximum allowed size",
      );
    }
  });

  describe("Query Telemetry Schema", () => {
    it("accepts valid query parameters", () => {
      const query = {
        from: "2026-09-28T00:00:00.000Z",
        to: "2026-09-28T23:59:59.000Z",
        page: "2",
        pageSize: "100",
        sortOrder: "desc",
      };
      const result = queryTelemetrySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(100);
        expect(result.data.sortOrder).toBe("desc");
        expect(result.data.from).toBeInstanceOf(Date);
        expect(result.data.to).toBeInstanceOf(Date);
      }
    });

    it("rejects from date that is later than to date", () => {
      const query = {
        from: "2026-09-29T12:00:00.000Z",
        to: "2026-09-28T12:00:00.000Z",
      };
      const result = queryTelemetrySchema.safeParse(query);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "from date must be earlier than or equal to to date",
        );
      }
    });

    it("caps pageSize to maximum 200", () => {
      const query = {
        pageSize: "500",
      };
      const result = queryTelemetrySchema.safeParse(query);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("cannot exceed 200");
      }
    });

    it("rejects page < 1", () => {
      const query = {
        page: "0",
      };
      const result = queryTelemetrySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });
});
