import {
  AlertRuleEntity,
  AlertRuleVersionEntity,
  AlertSeverity,
  RuleConditions,
} from "./alert.entity";

/**
 * Repository interface for versioned alert rules.
 */
export interface IAlertRuleRepository {
  /**
   * Retrieves all currently active rule versions that should be evaluated against incoming telemetry.
   */
  listActiveRuleVersions(): Promise<AlertRuleVersionEntity[]>;

  /**
   * Finds a rule definition by its stable code.
   */
  findRuleByCode(ruleCode: string): Promise<AlertRuleEntity | null>;

  /**
   * Finds a specific rule version by ID.
   */
  findVersionById(versionId: string): Promise<AlertRuleVersionEntity | null>;

  /**
   * Creates a rule definition.
   */
  createRule(rule: {
    ruleCode: string;
    name: string;
    description: string;
    eventType: string;
  }): Promise<AlertRuleEntity>;

  /**
   * Appends an immutable version configuration to a rule.
   */
  createRuleVersion(version: {
    ruleId: string;
    version: number;
    isActive: boolean;
    severity: AlertSeverity;
    conditions: RuleConditions;
    description?: string | null;
  }): Promise<AlertRuleVersionEntity>;
}
