import { prisma } from '../../config/database';
import { SelectedRule, RuleConfig } from './types';

export class RuleSelectorService {
  /**
   * Selects all applicable RuleVersions for a given product category and inspection timestamp.
   * Resolves version precedence by selecting the highest active rule version effective on inspectedAt.
   */
  static async selectRulesForInspection(
    categoryId: string,
    inspectedAt: Date = new Date()
  ): Promise<SelectedRule[]> {
    // 1. Fetch active rules with versions matching the category and date criteria
    const ruleVersionCategories = await prisma.ruleVersionCategory.findMany({
      where: {
        categoryId,
        ruleVersion: {
          rule: {
            isActive: true,
          },
          effectiveFrom: {
            lte: inspectedAt,
          },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: inspectedAt } },
          ],
        },
      },
      include: {
        ruleVersion: {
          include: {
            rule: true,
          },
        },
      },
    });

    // 2. Group candidate versions by ruleId and select the highest version number
    const ruleMap = new Map<string, SelectedRule>();

    for (const rvc of ruleVersionCategories) {
      const rv = rvc.ruleVersion;
      const rule = rv.rule;

      const candidate: SelectedRule = {
        ruleId: rule.id,
        ruleVersionId: rv.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        category: rule.category,
        version: rv.version,
        validationType: rv.validationType,
        requirement: rv.requirement,
        configuration: (rv.configuration as RuleConfig) || null,
        effectiveFrom: rv.effectiveFrom,
        effectiveTo: rv.effectiveTo,
      };

      const existing = ruleMap.get(rule.id);
      if (!existing || candidate.version > existing.version) {
        ruleMap.set(rule.id, candidate);
      }
    }

    return Array.from(ruleMap.values());
  }
}
