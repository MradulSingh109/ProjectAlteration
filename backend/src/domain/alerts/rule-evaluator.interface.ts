import { CanonicalTelemetryReading } from "@/domain/telemetry/telemetry.entity";
import { AlertRuleVersionEntity, AlertEvidence } from "./alert.entity";

export interface EvaluationOutcome {
  triggered: boolean;
  explanation?: string;
  evidence?: AlertEvidence;
}

/**
 * Interface for deterministic rule evaluators.
 * Must be pure, stateless, and free of side effects.
 */
export interface IRuleEvaluator {
  evaluate(
    ruleVersion: AlertRuleVersionEntity,
    reading: CanonicalTelemetryReading,
    wellContext?: { id: string; wellId: string; name: string },
    recentReadings?: CanonicalTelemetryReading[],
  ): EvaluationOutcome;
}
