import { describe, it, expect } from "vitest";
import { DeterministicRuleEvaluator } from "@/domain/alerts/deterministic-evaluator";
import { AlertRuleVersionEntity } from "@/domain/alerts/alert.entity";
import { CanonicalTelemetryReading } from "@/domain/telemetry/telemetry.entity";
import { INITIAL_ALERT_RULES } from "@/domain/alerts/initial-rules";

describe("Deterministic Alert Rule Evaluator", () => {
  const evaluator = new DeterministicRuleEvaluator();

  const pressureRuleVersion: AlertRuleVersionEntity = {
    id: "ver-pressure-1",
    ruleId: "rule-pressure-1",
    version: 1,
    isActive: true,
    severity: "HIGH",
    conditions: INITIAL_ALERT_RULES[0].conditions,
    description: INITIAL_ALERT_RULES[0].versionDescription,
    createdAt: new Date(),
    rule: {
      id: "rule-pressure-1",
      ruleCode: "PRESSURE_SPIKE_DETECT",
      name: "Standpipe Pressure Spike Detection",
      description: "Detects standpipe pressure spike",
      eventType: "PRESSURE_SPIKE",
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const torqueRuleVersion: AlertRuleVersionEntity = {
    id: "ver-torque-1",
    ruleId: "rule-torque-1",
    version: 1,
    isActive: true,
    severity: "HIGH",
    conditions: INITIAL_ALERT_RULES[1].conditions,
    description: INITIAL_ALERT_RULES[1].versionDescription,
    createdAt: new Date(),
    rule: {
      id: "rule-torque-1",
      ruleCode: "TORQUE_SPIKE_DETECT",
      name: "Surface Torque Spike Detection",
      description: "Detects surface torque spike",
      eventType: "TORQUE_SPIKE",
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mudLossRuleVersion: AlertRuleVersionEntity = {
    id: "ver-mudloss-1",
    ruleId: "rule-mudloss-1",
    version: 1,
    isActive: true,
    severity: "CRITICAL",
    conditions: INITIAL_ALERT_RULES[2].conditions,
    description: INITIAL_ALERT_RULES[2].versionDescription,
    createdAt: new Date(),
    rule: {
      id: "rule-mudloss-1",
      ruleCode: "MUD_FLOW_DISCREPANCY_DETECT",
      name: "Mud Flow In vs Out Discrepancy Detection",
      description: "Detects mud flow deficit",
      eventType: "MUD_LOSS",
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const baseReading: CanonicalTelemetryReading = {
    id: "reading-100",
    wellId: "well-test-1",
    sourceId: "RIG-01",
    sequenceNumber: 1,
    timestamp: new Date("2026-09-28T12:00:00Z"),
    measurements: {
      depthMd: 2500,
      depthTvd: 2480,
      rateOfPenetration: 15,
      hookLoad: 200,
      standpipePressure: 3200, // below 4500 psi threshold
      surfaceTorque: 12000, // below 18000 ft-lbf threshold
      flowRateIn: 500,
      flowRateOut: 495, // delta = 5 <= 50 gpm threshold
      mudDensity: 10.5,
    },
    ingestedAt: new Date(),
    createdAt: new Date(),
  };

  describe("Pressure Spike Rule", () => {
    it("does not trigger alert when standpipe pressure is below threshold", () => {
      const outcome = evaluator.evaluate(pressureRuleVersion, baseReading);
      expect(outcome.triggered).toBe(false);
    });

    it("does not trigger alert when standpipe pressure exactly equals threshold (strictly > required)", () => {
      const reading = {
        ...baseReading,
        measurements: { ...baseReading.measurements, standpipePressure: 4500 },
      };
      const outcome = evaluator.evaluate(pressureRuleVersion, reading);
      expect(outcome.triggered).toBe(false);
    });

    it("triggers alert when standpipe pressure exceeds demonstration threshold", () => {
      const reading = {
        ...baseReading,
        measurements: {
          ...baseReading.measurements,
          standpipePressure: 4850.5,
        },
      };
      const outcome = evaluator.evaluate(pressureRuleVersion, reading, {
        id: "well-test-1",
        wellId: "WELL-01",
        name: "Alpha Exploration",
      });

      expect(outcome.triggered).toBe(true);
      expect(outcome.explanation).toContain("PRESSURE_SPIKE_DETECT (v1)");
      expect(outcome.explanation).toContain("4850.50 psi");
      expect(outcome.explanation).toContain("4500.00 psi");
      expect(outcome.evidence?.observedValue).toBe(4850.5);
      expect(outcome.evidence?.threshold).toBe(4500);
      expect(outcome.evidence?.unit).toBe("psi");
    });

    it("does not trigger alert when pressure measurement is null or undefined", () => {
      const reading = {
        ...baseReading,
        measurements: { ...baseReading.measurements, standpipePressure: null },
      };
      const outcome = evaluator.evaluate(pressureRuleVersion, reading);
      expect(outcome.triggered).toBe(false);
    });
  });

  describe("Torque Spike Rule", () => {
    it("does not trigger alert when torque is below threshold", () => {
      const outcome = evaluator.evaluate(torqueRuleVersion, baseReading);
      expect(outcome.triggered).toBe(false);
    });

    it("triggers alert when torque exceeds demonstration threshold", () => {
      const reading = {
        ...baseReading,
        measurements: { ...baseReading.measurements, surfaceTorque: 19500 },
      };
      const outcome = evaluator.evaluate(torqueRuleVersion, reading);

      expect(outcome.triggered).toBe(true);
      expect(outcome.explanation).toContain("TORQUE_SPIKE_DETECT");
      expect(outcome.explanation).toContain("19500.00 ft-lbf");
      expect(outcome.evidence?.observedValue).toBe(19500);
      expect(outcome.evidence?.threshold).toBe(18000);
    });
  });

  describe("Mud Flow Discrepancy Rule", () => {
    it("does not trigger alert when flow delta is within acceptable range", () => {
      const outcome = evaluator.evaluate(mudLossRuleVersion, baseReading);
      expect(outcome.triggered).toBe(false);
    });

    it("triggers critical alert when flow in exceeds flow out beyond threshold (e.g. 500 in, 420 out = 80 gpm delta)", () => {
      const reading = {
        ...baseReading,
        measurements: {
          ...baseReading.measurements,
          flowRateIn: 500,
          flowRateOut: 420,
        },
      };
      const outcome = evaluator.evaluate(mudLossRuleVersion, reading);

      expect(outcome.triggered).toBe(true);
      expect(outcome.explanation).toContain("MUD_FLOW_DISCREPANCY_DETECT");
      expect(outcome.explanation).toContain("80.00 gpm");
      expect(outcome.explanation).toContain("50.00 gpm");
      expect(outcome.evidence?.observedValue).toEqual({
        flowRateIn: 500,
        flowRateOut: 420,
        delta: 80,
      });
    });

    it("does not trigger if flowRateIn or flowRateOut is missing", () => {
      const reading = {
        ...baseReading,
        measurements: {
          ...baseReading.measurements,
          flowRateIn: 500,
          flowRateOut: null,
        },
      };
      const outcome = evaluator.evaluate(mudLossRuleVersion, reading);
      expect(outcome.triggered).toBe(false);
    });
  });

  describe("Determinism Verification", () => {
    it("evaluates identically across repeated runs with zero stochastic behavior", () => {
      const anomalyReading = {
        ...baseReading,
        measurements: {
          ...baseReading.measurements,
          standpipePressure: 4900,
        },
      };

      const first = evaluator.evaluate(pressureRuleVersion, anomalyReading);
      for (let i = 0; i < 50; i++) {
        const next = evaluator.evaluate(pressureRuleVersion, anomalyReading);
        expect(next.triggered).toBe(first.triggered);
        expect(next.explanation).toBe(first.explanation);
        expect(next.evidence).toEqual(first.evidence);
      }
    });
  });
});
