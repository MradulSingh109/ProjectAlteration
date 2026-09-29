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
    recentReadings?: CanonicalTelemetryReading[],
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
      const currentExceeded = delta > cond.threshold;

      if (!currentExceeded) {
        return { triggered: false };
      }

      const requiredConsecutive = cond.consecutiveReadings ?? 1;

      // If sustained condition requires multiple readings
      if (requiredConsecutive > 1) {
        const candidateReadings = recentReadings
          ? recentReadings.some((r) => r.id === reading.id)
            ? recentReadings
            : [...recentReadings, reading]
          : [reading];

        // Sort chronologically ascending by physical measurement timestamp (up to current reading timestamp)
        const chronologicalWindow = candidateReadings
          .filter((r) => r.timestamp.getTime() <= reading.timestamp.getTime())
          .sort((a, b) => {
            const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
            if (timeDiff !== 0) return timeDiff;
            return Number(a.sequenceNumber - b.sequenceNumber);
          });

        const targetSlice = chronologicalWindow.slice(-requiredConsecutive);

        if (targetSlice.length < requiredConsecutive) {
          return { triggered: false };
        }

        // Verify all readings in the consecutive window satisfy the discrepancy condition
        for (const r of targetSlice) {
          const a = r.measurements[cond.metricA];
          const b = r.measurements[cond.metricB];
          if (a == null || b == null) {
            return { triggered: false };
          }
          const d = a - b;
          const met = d > cond.threshold;
          if (!met) {
            // Sustained condition interrupted by normal or missing reading
            return { triggered: false };
          }
        }
      }

      const isSustained = requiredConsecutive > 1;
      const explanation = isSustained
        ? `Rule ${ruleCode} (v${versionNumber}) triggered for well ${wellIdentifier}: ` +
          `Sustained mud flow discrepancy detected across ${requiredConsecutive} consecutive readings. ` +
          `Current reading at depth ${reading.measurements.depthMd.toFixed(2)}m observed flowRateIn (${valA.toFixed(2)} ${cond.unit}) ` +
          `exceeding flowRateOut (${valB.toFixed(2)} ${cond.unit}) with calculated discrepancy of ${delta.toFixed(2)} ${cond.unit}, ` +
          `exceeding configured threshold of ${cond.threshold.toFixed(2)} ${cond.unit} across all ${requiredConsecutive} consecutive readings (rule version v${versionNumber}).`
        : `Rule ${ruleCode} (v${versionNumber}) triggered for well ${wellIdentifier}: ` +
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
            calculatedDiscrepancy: delta,
            consecutiveReadingsObserved: isSustained ? requiredConsecutive : 1,
          },
          threshold: {
            thresholdDelta: cond.threshold,
            consecutiveReadingsRequired: requiredConsecutive,
          },
          unit: cond.unit,
          measurementTimestamp: reading.timestamp.toISOString(),
          readingSequenceNumber: reading.sequenceNumber,
          depthMd: reading.measurements.depthMd,
          conditionDescription: isSustained
            ? `Sustained (${cond.metricA} - ${cond.metricB}) ${cond.operator} ${cond.threshold} ${cond.unit} for ${requiredConsecutive} consecutive readings`
            : `(${cond.metricA} - ${cond.metricB}) ${cond.operator} ${cond.threshold} ${cond.unit}`,
        },
      };
    }

    return { triggered: false };
  }
}

export const deterministicRuleEvaluator = new DeterministicRuleEvaluator();
