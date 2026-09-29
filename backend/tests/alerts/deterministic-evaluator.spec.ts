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

  describe("Mud Flow Discrepancy Rule (Sustained Condition)", () => {
    const makeReading = (
      id: string,
      seq: number,
      timestampStr: string,
      flowIn: number,
      flowOut: number,
    ): CanonicalTelemetryReading => ({
      ...baseReading,
      id,
      sequenceNumber: seq,
      timestamp: new Date(timestampStr),
      measurements: {
        ...baseReading.measurements,
        flowRateIn: flowIn,
        flowRateOut: flowOut,
      },
    });

    const r1 = makeReading("r-1", 1, "2026-09-28T12:00:00Z", 500, 420); // delta = 80 > 50
    const r2 = makeReading("r-2", 2, "2026-09-28T12:00:10Z", 500, 415); // delta = 85 > 50
    const r3 = makeReading("r-3", 3, "2026-09-28T12:00:20Z", 500, 410); // delta = 90 > 50
    const rNormal = makeReading("r-norm", 2, "2026-09-28T12:00:10Z", 500, 485); // delta = 15 <= 50 (normal)

    it("1. does not trigger alert when flow delta is below threshold", () => {
      const outcome = evaluator.evaluate(mudLossRuleVersion, baseReading);
      expect(outcome.triggered).toBe(false);
    });

    it("2. does not trigger sustained alert on a single reading above threshold", () => {
      const outcome = evaluator.evaluate(mudLossRuleVersion, r1, undefined, [
        r1,
      ]);
      expect(outcome.triggered).toBe(false);
    });

    it("does not trigger sustained alert when only 2 of 3 required consecutive readings are above threshold", () => {
      const outcome = evaluator.evaluate(mudLossRuleVersion, r2, undefined, [
        r1,
        r2,
      ]);
      expect(outcome.triggered).toBe(false);
    });

    it("3. triggers alert when required consecutive readings (3) are all above threshold", () => {
      const outcome = evaluator.evaluate(mudLossRuleVersion, r3, undefined, [
        r1,
        r2,
        r3,
      ]);

      expect(outcome.triggered).toBe(true);
      expect(outcome.explanation).toContain("MUD_FLOW_DISCREPANCY_DETECT (v1)");
      expect(outcome.explanation).toContain(
        "Sustained mud flow discrepancy detected across 3 consecutive readings",
      );
      expect(outcome.explanation).toContain("90.00 gpm");
      expect(outcome.explanation).toContain("50.00 gpm");
      expect(outcome.evidence?.metric).toBe("flowRateIn - flowRateOut");
      expect(outcome.evidence?.observedValue).toEqual({
        flowRateIn: 500,
        flowRateOut: 410,
        calculatedDiscrepancy: 90,
        consecutiveReadingsObserved: 3,
      });
      expect(outcome.evidence?.threshold).toEqual({
        thresholdDelta: 50,
        consecutiveReadingsRequired: 3,
      });
    });

    it("4. resets sustained condition when interrupted by a normal reading", () => {
      // Sequence: r1 (above), rNormal (normal), r3 (above)
      const windowWithNormal = [r1, rNormal, r3];
      const outcome = evaluator.evaluate(
        mudLossRuleVersion,
        r3,
        undefined,
        windowWithNormal,
      );

      expect(outcome.triggered).toBe(false);
    });

    it("5. validates exact boundary threshold behavior (strictly > threshold)", () => {
      // Exactly 50.0 gpm delta across 3 readings
      const b1 = makeReading("b-1", 1, "2026-09-28T12:00:00Z", 500, 450); // delta = 50.0
      const b2 = makeReading("b-2", 2, "2026-09-28T12:00:10Z", 500, 450);
      const b3 = makeReading("b-3", 3, "2026-09-28T12:00:20Z", 500, 450);

      const exactOutcome = evaluator.evaluate(
        mudLossRuleVersion,
        b3,
        undefined,
        [b1, b2, b3],
      );
      expect(exactOutcome.triggered).toBe(false);

      // Just above boundary: 50.01 gpm delta
      const a1 = makeReading("a-1", 1, "2026-09-28T12:00:00Z", 500.01, 450);
      const a2 = makeReading("a-2", 2, "2026-09-28T12:00:10Z", 500.01, 450);
      const a3 = makeReading("a-3", 3, "2026-09-28T12:00:20Z", 500.01, 450);

      const aboveOutcome = evaluator.evaluate(
        mudLossRuleVersion,
        a3,
        undefined,
        [a1, a2, a3],
      );
      expect(aboveOutcome.triggered).toBe(true);
    });

    it("6. correctly handles out-of-order reading arrays by chronological timestamp ordering", () => {
      // Pass readings in scrambled arrival order: [r3, r1, r2]
      const scrambled = [r3, r1, r2];
      const outcome = evaluator.evaluate(
        mudLossRuleVersion,
        r3,
        undefined,
        scrambled,
      );
      expect(outcome.triggered).toBe(true);

      // Scrambled order with interruption: [r3, rNormal, r1]
      const scrambledInterrupted = [r3, rNormal, r1];
      const outcomeInterrupted = evaluator.evaluate(
        mudLossRuleVersion,
        r3,
        undefined,
        scrambledInterrupted,
      );
      expect(outcomeInterrupted.triggered).toBe(false);
    });

    it("7. same telemetry window + same rule version produces idempotent identical result", () => {
      const window = [r1, r2, r3];
      const outcomeA = evaluator.evaluate(
        mudLossRuleVersion,
        r3,
        undefined,
        window,
      );
      const outcomeB = evaluator.evaluate(
        mudLossRuleVersion,
        r3,
        undefined,
        window,
      );

      expect(outcomeA.triggered).toBe(true);
      expect(outcomeB.triggered).toBe(true);
      expect(outcomeA.explanation).toBe(outcomeB.explanation);
      expect(outcomeA.evidence).toEqual(outcomeB.evidence);
    });

    it("8. deterministic repeated evaluation produces identical decision and evidence across 50 iterations", () => {
      const window = [r1, r2, r3];
      const baseline = evaluator.evaluate(
        mudLossRuleVersion,
        r3,
        undefined,
        window,
      );

      for (let i = 0; i < 50; i++) {
        const current = evaluator.evaluate(
          mudLossRuleVersion,
          r3,
          undefined,
          window,
        );
        expect(current.triggered).toBe(baseline.triggered);
        expect(current.explanation).toBe(baseline.explanation);
        expect(current.evidence).toEqual(baseline.evidence);
      }
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
