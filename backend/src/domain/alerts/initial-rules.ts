import { EventSeverity } from "@prisma/client";
import { RuleConditions } from "./alert.entity";

export interface InitialRuleDefinition {
  ruleCode: string;
  name: string;
  description: string;
  eventType: string;
  version: number;
  severity: EventSeverity;
  conditions: RuleConditions;
  versionDescription: string;
}

/**
 * Initial deterministic rule set for SIH 2026 PS 121.
 *
 * NOTE: The numeric thresholds specified below are configurable demonstration/testing values.
 * They are NOT official or calibrated field engineering limits. Domain experts must calibrate
 * thresholds prior to production deployment.
 */
export const INITIAL_ALERT_RULES: InitialRuleDefinition[] = [
  {
    ruleCode: "PRESSURE_SPIKE_DETECT",
    name: "Standpipe Pressure Spike Detection",
    description:
      "Detects elevated standpipe pressure exceeding demonstration operating limit, indicating potential bit nozzle plugging or downhole pack-off.",
    eventType: "PRESSURE_SPIKE",
    version: 1,
    severity: "HIGH",
    conditions: {
      type: "THRESHOLD",
      metric: "standpipePressure",
      operator: ">",
      threshold: 4500.0,
      unit: "psi",
    },
    versionDescription:
      "Initial demonstration threshold of 4,500 psi standpipe pressure.",
  },
  {
    ruleCode: "TORQUE_SPIKE_DETECT",
    name: "Surface Torque Spike Detection",
    description:
      "Detects elevated rotary surface torque exceeding demonstration operating limit, indicating tight hole, differential sticking, or mechanical drag.",
    eventType: "TORQUE_SPIKE",
    version: 1,
    severity: "HIGH",
    conditions: {
      type: "THRESHOLD",
      metric: "surfaceTorque",
      operator: ">",
      threshold: 18000.0,
      unit: "ft-lbf",
    },
    versionDescription:
      "Initial demonstration threshold of 18,000 ft-lbf surface torque.",
  },
  {
    ruleCode: "MUD_FLOW_DISCREPANCY_DETECT",
    name: "Mud Flow In vs Out Discrepancy Detection",
    description:
      "Detects significant deficit between mud flow in and mud flow out, indicating possible fluid loss into porous or fractured formations.",
    eventType: "MUD_LOSS",
    version: 1,
    severity: "CRITICAL",
    conditions: {
      type: "DELTA",
      metricA: "flowRateIn",
      metricB: "flowRateOut",
      operator: ">",
      threshold: 50.0,
      unit: "gpm",
    },
    versionDescription:
      "Initial demonstration threshold: flow-in exceeding flow-out by >= 50 gpm.",
  },
];
