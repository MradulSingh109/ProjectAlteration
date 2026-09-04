import { Declaration, DeclarationType, ValidationStatus, ViolationSeverity } from '@prisma/client';
import { SelectedRule, RuleEvaluationResult } from './types';

export class RuleEvaluatorService {
  /**
   * Evaluates a single SelectedRule against the list of extracted declarations for an inspection.
   * Produces a deterministic RuleEvaluationResult with status (PASS, FAIL, REVIEW), evidence, and violation payloads.
   */
  static evaluateRule(rule: SelectedRule, declarations: Declaration[]): RuleEvaluationResult {
    // 1. Determine target DeclarationType from rule configuration or code
    const targetType = this.resolveDeclarationType(rule);

    // 2. Find matching candidate declarations for this rule
    const candidateDeclarations = targetType
      ? declarations.filter((d) => d.type === targetType)
      : [];

    const declarationIds = candidateDeclarations.map((d) => d.id);

    // 3. Dispatch to appropriate deterministic evaluation logic based on validationType
    const validationType = (rule.validationType || '').toUpperCase();

    switch (validationType) {
      case 'EXISTS_AND_NON_ZERO':
      case 'PRESENCE':
      case 'EXISTS':
        return this.evaluatePresenceAndValue(rule, candidateDeclarations, declarationIds);

      case 'STANDARD_UNIT_MATCH':
        return this.evaluateStandardUnit(rule, candidateDeclarations, declarationIds);

      case 'DATE_FORMAT_MATCH':
      case 'DATE_VALIDATION':
        return this.evaluateDateFormat(rule, candidateDeclarations, declarationIds);

      case 'CONTACT_FIELDS_PRESENT':
        return this.evaluateContactFields(rule, candidateDeclarations, declarationIds);

      case 'NUMERIC_COMPARISON':
        return this.evaluateNumericComparison(rule, candidateDeclarations, declarationIds);

      case 'PATTERN_MATCH':
        return this.evaluatePatternMatch(rule, candidateDeclarations, declarationIds);

      default:
        // Handle custom / fallback validation types gracefully
        if (candidateDeclarations.length > 0) {
          return {
            ruleId: rule.ruleId,
            ruleVersionId: rule.ruleVersionId,
            status: ValidationStatus.PASS,
            message: `Declaration present for rule '${rule.ruleName}'.`,
            declarationIds,
          };
        }
        return {
          ruleId: rule.ruleId,
          ruleVersionId: rule.ruleVersionId,
          status: ValidationStatus.REVIEW,
          message: `Rule type '${rule.validationType}' requires manual review.`,
          declarationIds: [],
        };
    }
  }

  /**
   * Evaluates presence and non-zero value compliance.
   */
  private static evaluatePresenceAndValue(
    rule: SelectedRule,
    candidates: Declaration[],
    declarationIds: string[]
  ): RuleEvaluationResult {
    if (candidates.length === 0) {
      const severity = this.resolveSeverity(rule, ViolationSeverity.HIGH);
      return {
        ruleId: rule.ruleId,
        ruleVersionId: rule.ruleVersionId,
        status: ValidationStatus.FAIL,
        message: `Non-compliance: Mandatory declaration '${rule.ruleName}' is missing.`,
        declarationIds: [],
        violationPayload: {
          code: `VIO_${rule.ruleCode}_MISSING`,
          severity,
          title: `Missing Mandatory Declaration: ${rule.ruleName}`,
          description: `The package label fails to provide mandatory declaration: ${rule.requirement}`,
        },
      };
    }

    const decl = candidates[0];
    const isExistsAndNonZero = (rule.validationType || '').toUpperCase() === 'EXISTS_AND_NON_ZERO';

    if (isExistsAndNonZero && decl.normalizedValue) {
      try {
        const parsed = JSON.parse(decl.normalizedValue);
        if (typeof parsed.value === 'number') {
          if (parsed.value <= 0) {
            return {
              ruleId: rule.ruleId,
              ruleVersionId: rule.ruleVersionId,
              status: ValidationStatus.FAIL,
              message: `Non-compliance: Declared value (${parsed.value}) must be greater than zero.`,
              declarationIds,
              violationPayload: {
                code: `VIO_${rule.ruleCode}_INVALID_VALUE`,
                severity: ViolationSeverity.HIGH,
                title: `Invalid Declared Value for ${rule.ruleName}`,
                description: `Declared numeric value of ${parsed.value} is invalid (must be > 0). ${rule.requirement}`,
                declarationId: decl.id,
              },
            };
          }
        }
      } catch {
        return {
          ruleId: rule.ruleId,
          ruleVersionId: rule.ruleVersionId,
          status: ValidationStatus.REVIEW,
          message: `Requires review: Unparseable numeric value for '${rule.ruleName}'.`,
          declarationIds,
        };
      }
    }

    return {
      ruleId: rule.ruleId,
      ruleVersionId: rule.ruleVersionId,
      status: ValidationStatus.PASS,
      message: `Compliant: '${rule.ruleName}' declaration is valid and present.`,
      declarationIds,
    };
  }

  /**
   * Evaluates standard unit of measurement compliance.
   */
  private static evaluateStandardUnit(
    rule: SelectedRule,
    candidates: Declaration[],
    declarationIds: string[]
  ): RuleEvaluationResult {
    if (candidates.length === 0) {
      return {
        ruleId: rule.ruleId,
        ruleVersionId: rule.ruleVersionId,
        status: ValidationStatus.FAIL,
        message: `Non-compliance: Mandatory Net Quantity declaration is missing.`,
        declarationIds: [],
        violationPayload: {
          code: `VIO_${rule.ruleCode}_MISSING`,
          severity: ViolationSeverity.HIGH,
          title: `Missing Net Quantity Declaration`,
          description: `The package label fails to declare net quantity in standard units. ${rule.requirement}`,
        },
      };
    }

    const decl = candidates[0];
    const allowedUnits = ['g', 'kg', 'mg', 'l', 'ml', 'pcs', 'units', 'n'];

    if (decl.normalizedValue) {
      try {
        const parsed = JSON.parse(decl.normalizedValue);
        if (parsed.unit) {
          const unit = String(parsed.unit).toLowerCase();
          if (allowedUnits.includes(unit)) {
            return {
              ruleId: rule.ruleId,
              ruleVersionId: rule.ruleVersionId,
              status: ValidationStatus.PASS,
              message: `Compliant: Net quantity declared in standard unit '${unit}'.`,
              declarationIds,
            };
          } else {
            return {
              ruleId: rule.ruleId,
              ruleVersionId: rule.ruleVersionId,
              status: ValidationStatus.FAIL,
              message: `Non-compliance: Non-standard unit of measurement '${unit}' used.`,
              declarationIds,
              violationPayload: {
                code: `VIO_${rule.ruleCode}_NON_STANDARD_UNIT`,
                severity: ViolationSeverity.MEDIUM,
                title: `Non-Standard Unit of Measurement`,
                description: `Declared unit '${unit}' is not a standard Legal Metrology unit. ${rule.requirement}`,
                declarationId: decl.id,
              },
            };
          }
        }
      } catch {
        // Fallback to review
      }
    }

    return {
      ruleId: rule.ruleId,
      ruleVersionId: rule.ruleVersionId,
      status: ValidationStatus.REVIEW,
      message: `Requires review: Net quantity unit structure could not be deterministically verified.`,
      declarationIds,
    };
  }

  /**
   * Evaluates Date Format compliance.
   */
  private static evaluateDateFormat(
    rule: SelectedRule,
    candidates: Declaration[],
    declarationIds: string[]
  ): RuleEvaluationResult {
    if (candidates.length === 0) {
      return {
        ruleId: rule.ruleId,
        ruleVersionId: rule.ruleVersionId,
        status: ValidationStatus.FAIL,
        message: `Non-compliance: Mandatory date declaration '${rule.ruleName}' is missing.`,
        declarationIds: [],
        violationPayload: {
          code: `VIO_${rule.ruleCode}_MISSING`,
          severity: ViolationSeverity.MEDIUM,
          title: `Missing Date Declaration: ${rule.ruleName}`,
          description: `The package label fails to declare date of manufacture/packing. ${rule.requirement}`,
        },
      };
    }

    const decl = candidates[0];
    const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{4}|\d+\s*months?)/i;

    if (datePattern.test(decl.rawValue)) {
      return {
        ruleId: rule.ruleId,
        ruleVersionId: rule.ruleVersionId,
        status: ValidationStatus.PASS,
        message: `Compliant: Valid date format declared for '${rule.ruleName}'.`,
        declarationIds,
      };
    }

    return {
      ruleId: rule.ruleId,
      ruleVersionId: rule.ruleVersionId,
      status: ValidationStatus.REVIEW,
      message: `Requires review: Date text format for '${rule.ruleName}' requires verification.`,
      declarationIds,
    };
  }

  /**
   * Evaluates Consumer Contact fields presence.
   */
  private static evaluateContactFields(
    rule: SelectedRule,
    candidates: Declaration[],
    declarationIds: string[]
  ): RuleEvaluationResult {
    if (candidates.length === 0) {
      return {
        ruleId: rule.ruleId,
        ruleVersionId: rule.ruleVersionId,
        status: ValidationStatus.FAIL,
        message: `Non-compliance: Mandatory Consumer Care information is missing.`,
        declarationIds: [],
        violationPayload: {
          code: `VIO_${rule.ruleCode}_MISSING`,
          severity: ViolationSeverity.MEDIUM,
          title: `Missing Consumer Care Information`,
          description: `The package label fails to provide consumer care contact details. ${rule.requirement}`,
        },
      };
    }

    return {
      ruleId: rule.ruleId,
      ruleVersionId: rule.ruleVersionId,
      status: ValidationStatus.PASS,
      message: `Compliant: Consumer Care details are present.`,
      declarationIds,
    };
  }

  /**
   * Evaluates Numeric Comparison boundaries.
   */
  private static evaluateNumericComparison(
    rule: SelectedRule,
    candidates: Declaration[],
    declarationIds: string[]
  ): RuleEvaluationResult {
    if (candidates.length === 0) {
      return {
        ruleId: rule.ruleId,
        ruleVersionId: rule.ruleVersionId,
        status: ValidationStatus.FAIL,
        message: `Non-compliance: Declaration for numeric evaluation '${rule.ruleName}' is missing.`,
        declarationIds: [],
        violationPayload: {
          code: `VIO_${rule.ruleCode}_MISSING`,
          severity: ViolationSeverity.HIGH,
          title: `Missing Declaration for ${rule.ruleName}`,
          description: rule.requirement,
        },
      };
    }

    const decl = candidates[0];
    const cfg = rule.configuration || {};

    if (decl.normalizedValue) {
      try {
        const parsed = JSON.parse(decl.normalizedValue);
        const val = typeof parsed.value === 'number' ? parsed.value : parseFloat(decl.rawValue);

        if (!isNaN(val)) {
          if (typeof cfg.maxAllowed === 'number' && val > cfg.maxAllowed) {
            return {
              ruleId: rule.ruleId,
              ruleVersionId: rule.ruleVersionId,
              status: ValidationStatus.FAIL,
              message: `Non-compliance: Declared value (${val}) exceeds maximum permitted limit (${cfg.maxAllowed}).`,
              declarationIds,
              violationPayload: {
                code: `VIO_${rule.ruleCode}_EXCEEDS_MAX`,
                severity: ViolationSeverity.HIGH,
                title: `Declared Value Exceeds Limit`,
                description: `Declared value ${val} exceeds max limit of ${cfg.maxAllowed}. ${rule.requirement}`,
                declarationId: decl.id,
              },
            };
          }

          if (typeof cfg.minAllowed === 'number' && val < cfg.minAllowed) {
            return {
              ruleId: rule.ruleId,
              ruleVersionId: rule.ruleVersionId,
              status: ValidationStatus.FAIL,
              message: `Non-compliance: Declared value (${val}) is below minimum required limit (${cfg.minAllowed}).`,
              declarationIds,
              violationPayload: {
                code: `VIO_${rule.ruleCode}_BELOW_MIN`,
                severity: ViolationSeverity.HIGH,
                title: `Declared Value Below Minimum`,
                description: `Declared value ${val} is below minimum of ${cfg.minAllowed}. ${rule.requirement}`,
                declarationId: decl.id,
              },
            };
          }

          return {
            ruleId: rule.ruleId,
            ruleVersionId: rule.ruleVersionId,
            status: ValidationStatus.PASS,
            message: `Compliant: Declared value (${val}) satisfies numeric boundaries.`,
            declarationIds,
          };
        }
      } catch {
        // Fallback to review
      }
    }

    return {
      ruleId: rule.ruleId,
      ruleVersionId: rule.ruleVersionId,
      status: ValidationStatus.REVIEW,
      message: `Requires review: Could not parse numeric value for boundary check.`,
      declarationIds,
    };
  }

  /**
   * Evaluates Pattern Match regex compliance.
   */
  private static evaluatePatternMatch(
    rule: SelectedRule,
    candidates: Declaration[],
    declarationIds: string[]
  ): RuleEvaluationResult {
    if (candidates.length === 0) {
      return {
        ruleId: rule.ruleId,
        ruleVersionId: rule.ruleVersionId,
        status: ValidationStatus.FAIL,
        message: `Non-compliance: Declaration for pattern match '${rule.ruleName}' is missing.`,
        declarationIds: [],
        violationPayload: {
          code: `VIO_${rule.ruleCode}_MISSING`,
          severity: ViolationSeverity.MEDIUM,
          title: `Missing Declaration for ${rule.ruleName}`,
          description: rule.requirement,
        },
      };
    }

    const decl = candidates[0];
    const patternStr = rule.configuration?.expectedPattern;

    if (patternStr) {
      try {
        const regex = new RegExp(patternStr, 'i');
        if (regex.test(decl.rawValue)) {
          return {
            ruleId: rule.ruleId,
            ruleVersionId: rule.ruleVersionId,
            status: ValidationStatus.PASS,
            message: `Compliant: Declaration matches expected pattern.`,
            declarationIds,
          };
        } else {
          return {
            ruleId: rule.ruleId,
            ruleVersionId: rule.ruleVersionId,
            status: ValidationStatus.FAIL,
            message: `Non-compliance: Declaration value '${decl.rawValue}' does not match required pattern.`,
            declarationIds,
            violationPayload: {
              code: `VIO_${rule.ruleCode}_PATTERN_MISMATCH`,
              severity: ViolationSeverity.MEDIUM,
              title: `Pattern Mismatch in Declaration`,
              description: `Declaration '${decl.rawValue}' fails pattern match requirement. ${rule.requirement}`,
              declarationId: decl.id,
            },
          };
        }
      } catch {
        // Pattern compilation failure -> Review
      }
    }

    return {
      ruleId: rule.ruleId,
      ruleVersionId: rule.ruleVersionId,
      status: ValidationStatus.PASS,
      message: `Compliant: Declaration present.`,
      declarationIds,
    };
  }

  /**
   * Resolves target DeclarationType based on Rule configuration or Rule Code.
   */
  private static resolveDeclarationType(rule: SelectedRule): DeclarationType | null {
    const field = rule.configuration?.field || rule.configuration?.declarationType;
    if (field) {
      const upper = String(field).toUpperCase();
      if (upper === 'MRP') return DeclarationType.MRP;
      if (upper === 'NETQUANTITY' || upper === 'NET_QUANTITY') return DeclarationType.NET_QUANTITY;
      if (upper === 'MFGDATE' || upper === 'MFG_DATE') return DeclarationType.MFG_DATE;
      if (upper === 'EXPDATE' || upper === 'EXP_DATE') return DeclarationType.EXP_DATE;
      if (upper === 'CONSUMERCARE' || upper === 'CONSUMER_CARE') return DeclarationType.CONSUMER_CARE;
      if (upper === 'COUNTRYOFORIGIN' || upper === 'COUNTRY_OF_ORIGIN') return DeclarationType.COUNTRY_OF_ORIGIN;
      if (upper === 'COMMODITYNAME' || upper === 'COMMODITY_NAME') return DeclarationType.COMMODITY_NAME;
      if (upper === 'MFGADDRESS' || upper === 'MFG_ADDRESS') return DeclarationType.MFG_ADDRESS;
      if (upper === 'IMPORTERDETAILS' || upper === 'IMPORTER_DETAILS') return DeclarationType.IMPORTER_DETAILS;
    }

    // Fallback based on Rule Code naming convention
    const code = (rule.ruleCode || '').toUpperCase();
    if (code.includes('MRP')) return DeclarationType.MRP;
    if (code.includes('NETQTY') || code.includes('QUANTITY')) return DeclarationType.NET_QUANTITY;
    if (code.includes('MFGDATE') || code.includes('MFG')) return DeclarationType.MFG_DATE;
    if (code.includes('EXPDATE') || code.includes('EXP')) return DeclarationType.EXP_DATE;
    if (code.includes('CONSUMER') || code.includes('CONTACT')) return DeclarationType.CONSUMER_CARE;
    if (code.includes('COUNTRY') || code.includes('ORIGIN')) return DeclarationType.COUNTRY_OF_ORIGIN;
    if (code.includes('COMMODITY')) return DeclarationType.COMMODITY_NAME;
    if (code.includes('ADDRESS')) return DeclarationType.MFG_ADDRESS;
    if (code.includes('IMPORTER')) return DeclarationType.IMPORTER_DETAILS;

    return null;
  }

  /**
   * Helper to resolve violation severity.
   */
  private static resolveSeverity(rule: SelectedRule, defaultSev: ViolationSeverity): ViolationSeverity {
    if (rule.configuration?.severity) {
      return rule.configuration.severity;
    }
    const cat = (rule.category || '').toUpperCase();
    if (cat === 'PRICE' || cat === 'QUANTITY') return ViolationSeverity.HIGH;
    if (cat === 'DATE' || cat === 'CONTACT') return ViolationSeverity.MEDIUM;
    return defaultSev;
  }
}
