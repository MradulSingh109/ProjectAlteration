import { ViolationSeverity, ViolationStatus, EvidenceType } from '@prisma/client';
import { ViolationPayload } from './types';

export class ViolationService {
  /**
   * Builds the structure for creating a Violation record and its linked Evidence.
   */
  static buildViolationRecord(
    inspectionId: string,
    validationResultId: string,
    payload: ViolationPayload
  ) {
    return {
      violationData: {
        inspectionId,
        validationResultId,
        code: payload.code,
        severity: payload.severity || ViolationSeverity.MEDIUM,
        title: payload.title,
        description: payload.description,
        status: ViolationStatus.OPEN,
      },
      evidenceData: payload.declarationId
        ? {
            declarationId: payload.declarationId,
            type: EvidenceType.DECLARATION,
            referenceId: payload.declarationId,
            metadata: {
              source: 'RULE_ENGINE',
              generatedAt: new Date().toISOString(),
            },
          }
        : null,
    };
  }
}
