import { CanonicalTelemetryReading } from "@/domain/telemetry/telemetry.entity";
import { AlertRuleVersionEntity } from "./alert.entity";
import { IRuleEvaluator, EvaluationOutcome } from "./rule-evaluator.interface";

/**
 * Deterministic, explainable rule evaluator.
 * Produces deterministic alert decisions and transparent explanations based on telemetry signals.
 * Free of random scoring, ML models, or heuristic ambiguity.
 */
export class DeterministicRuleEvaluator implements IRuleEvaluator {
  evaluate(
    ruleVersion: AlertRuleVersionEntity,
    reading: CanonicalTelemetryReading,
    wellContext?: { id: string; wellId: string; name: string },
  ): EvaluationOutcome {
    const wellIdentifier =
      wellContext?.name || wellContext?.wellId || reading.wellId;
    const ruleCode = ruleVersion.rule?.ruleCode || "RULE";
    const versionNumber = ruleVersion.version;
    const cond = ruleVersion.conditions;

    if (cond.type === "THRESHOLD") {
      const metricKey = cond.metric;
      const observed = reading.measurements[metricKey];

      // Missing or null measurement cannot trigger a threshold violation
      if (observed == null) {
        return { triggered: false };
      }

      let isTriggered = false;
      switch (cond.operator) {
        case ">":
          isTriggered = observed > cond.threshold;
          break;
        case ">=":
          isTriggered = observed >= cond.threshold;
          break;
        case "<":
          isTriggered = observed < cond.threshold;
          break;
        case "<=":
          isTriggered = observed <= cond.threshold;
          break;
      }

      if (!isTriggered) {
        return { triggered: false };
      }

      const explanation =
        `Rule ${ruleCode} (v${versionNumber}) triggered for well ${wellIdentifier}: ` +
        `${metricKey} was ${observed.toFixed(2)} ${cond.unit}, exceeding the demonstration threshold ` +
        `of ${cond.threshold.toFixed(2)} ${cond.unit} at measured depth ${reading.measurements.depthMd.toFixed(2)}m.`;

      return {
        triggered: true,
        explanation,
        evidence: {
          metric: metricKey,
          observedValue: observed,
          threshold: cond.threshold,
          unit: cond.unit,
          measurementTimestamp: reading.timestamp.toISOString(),
          readingSequenceNumber: reading.sequenceNumber,
          depthMd: reading.measurements.depthMd,
          conditionDescription: `${metricKey} ${cond.operator} ${cond.threshold} ${cond.unit}`,
        },
      };
    }

    if (cond.type === "DELTA") {
      const valA = reading.measurements[cond.metricA];
      const valB = reading.measurements[cond.metricB];

      // Both values must be present for delta comparison
      if (valA == null || valB == null) {
        return { triggered: false };
      }

      const delta = valA - valB;
      const isTriggered = delta > cond.threshold;

      if (!isTriggered) {
        return { triggered: false };
      }

      const explanation =
        `Rule ${ruleCode} (v${versionNumber}) triggered for well ${wellIdentifier}: ` +
        `Mud flow discrepancy observed. Flow in (${valA.toFixed(2)} ${cond.unit}) exceeded flow out ` +
        `(${valB.toFixed(2)} ${cond.unit}) by ${delta.toFixed(2)} ${cond.unit}, exceeding ` +
        `the demonstration threshold of ${cond.threshold.toFixed(2)} ${cond.unit} at measured depth ${reading.measurements.depthMd.toFixed(2)}m.`;

      return {
        triggered: true,
        explanation,
        evidence: {
          metric: `${cond.metricA} - ${cond.metricB}`,
          observedValue: {
            flowRateIn: valA,
            flowRateOut: valB,
            delta,
          },
          threshold: cond.threshold,
          unit: cond.unit,
          measurementTimestamp: reading.timestamp.toISOString(),
          readingSequenceNumber: reading.sequenceNumber,
          depthMd: reading.measurements.depthMd,
          conditionDescription: `(${cond.metricA} - ${cond.metricB}) ${cond.operator} ${cond.threshold} ${cond.unit}`,
        },
      };
    }

    return { triggered: false };
  }
}

export const deterministicRuleEvaluator = new DeterministicRuleEvaluator();
