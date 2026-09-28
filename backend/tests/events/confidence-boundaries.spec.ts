import { describe, it, expect } from "vitest";
import {
  createDrillingEventSchema,
  editedEventFieldsSchema,
} from "@/application/events/drilling-event.dto";

describe("Extraction Confidence Boundary Verification", () => {
  const validBasePayload = {
    eventType: "MUD_LOSS",
    severity: "HIGH",
    depthMd: 2500.5,
    description: "Loss of circulation",
    sourceDocumentId: "doc-uuid-1",
    sourcePage: 1,
  };

  it("accepts exact lower boundary extraction confidence of 0.000", () => {
    const parsed = createDrillingEventSchema.safeParse({
      ...validBasePayload,
      extractionConfidence: 0.0,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.extractionConfidence).toBe(0.0);
    }
  });

  it("accepts exact upper boundary extraction confidence of 1.000", () => {
    const parsed = createDrillingEventSchema.safeParse({
      ...validBasePayload,
      extractionConfidence: 1.0,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.extractionConfidence).toBe(1.0);
    }
  });

  it("rejects extraction confidence strictly below 0.000 (negative values)", () => {
    const parsed = createDrillingEventSchema.safeParse({
      ...validBasePayload,
      extractionConfidence: -0.001,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(
        /extractionConfidence must be between 0.0 and 1.0/i,
      );
    }
  });

  it("rejects extraction confidence strictly above 1.000", () => {
    const parsed = createDrillingEventSchema.safeParse({
      ...validBasePayload,
      extractionConfidence: 1.001,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(
        /extractionConfidence must be between 0.0 and 1.0/i,
      );
    }
  });

  it("enforces boundary checks on edited extraction confidence during review", () => {
    const lowerBound = editedEventFieldsSchema.safeParse({
      extractionConfidence: 0.0,
    });
    expect(lowerBound.success).toBe(true);

    const upperBound = editedEventFieldsSchema.safeParse({
      extractionConfidence: 1.0,
    });
    expect(upperBound.success).toBe(true);

    const belowZero = editedEventFieldsSchema.safeParse({
      extractionConfidence: -0.5,
    });
    expect(belowZero.success).toBe(false);

    const aboveOne = editedEventFieldsSchema.safeParse({
      extractionConfidence: 1.05,
    });
    expect(aboveOne.success).toBe(false);
  });
});
