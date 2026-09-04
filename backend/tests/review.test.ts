import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import {
  RoleCode,
  WorkflowStatus,
  ComplianceStatus,
  ValidationStatus,
  ViolationStatus,
  ViolationSeverity,
  EvidenceType,
  DeclarationType,
  DeclarationSource,
} from '@prisma/client';
import { generateToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

jest.setTimeout(30000);

describe('Step 9: Violation Management & Human Review Workflow API Tests', () => {
  const ts = Date.now();
  const testPassword = 'StrongPassword123!';

  let inspector1Token: string;
  let adminToken: string;
  let reviewerToken: string;

  let inspector1Id: string;
  let inspector2Id: string;

  let inspectionUnderReview1Id: string;
  let inspectionUnderReview2Id: string;
  let inspectionDraftId: string;
  let inspectionCompletedId: string;

  let validationResult1Id: string;

  let violation1Id: string;
  let violation2Id: string;

  beforeAll(async () => {
    // 1. Clean up test records
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step9.' } } } });
    await prisma.evidence.deleteMany({
      where: { violation: { inspection: { creator: { email: { contains: 'test.step9.' } } } } },
    });
    await prisma.violation.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.validationResult.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.declaration.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step9.' } } } });
    await prisma.ruleVersionCategory.deleteMany({ where: { category: { code: { contains: 'CAT-STEP9' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP9' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP9' } } });
    await prisma.ruleVersion.deleteMany({ where: { rule: { code: { contains: 'RULE-STEP9' } } } });
    await prisma.rule.deleteMany({ where: { code: { contains: 'RULE-STEP9' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step9.' } } });

    // 2. Roles & Users
    const inspectorRole = await prisma.role.upsert({
      where: { code: RoleCode.INSPECTOR },
      update: {},
      create: { code: RoleCode.INSPECTOR, name: 'Field Inspector' },
    });

    const adminRole = await prisma.role.upsert({
      where: { code: RoleCode.ADMIN },
      update: {},
      create: { code: RoleCode.ADMIN, name: 'System Administrator' },
    });

    const reviewerRole = await prisma.role.upsert({
      where: { code: RoleCode.REVIEWER },
      update: {},
      create: { code: RoleCode.REVIEWER, name: 'Compliance Reviewer' },
    });

    const hash = await hashPassword(testPassword);

    const inspector1 = await prisma.user.create({
      data: {
        name: 'Step9 Inspector 1',
        email: `test.step9.inspector1.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector1Id = inspector1.id;
    inspector1Token = generateToken({ sub: inspector1.id, role: RoleCode.INSPECTOR });

    const inspector2 = await prisma.user.create({
      data: {
        name: 'Step9 Inspector 2',
        email: `test.step9.inspector2.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector2Id = inspector2.id;

    const admin = await prisma.user.create({
      data: {
        name: 'Step9 Admin',
        email: `test.step9.admin.${ts}@example.com`,
        passwordHash: hash,
        roleId: adminRole.id,
      },
    });
    adminToken = generateToken({ sub: admin.id, role: RoleCode.ADMIN });

    const reviewer = await prisma.user.create({
      data: {
        name: 'Step9 Reviewer',
        email: `test.step9.reviewer.${ts}@example.com`,
        passwordHash: hash,
        roleId: reviewerRole.id,
      },
    });
    reviewerToken = generateToken({ sub: reviewer.id, role: RoleCode.REVIEWER });

    // 3. Category & Product
    const category = await prisma.productCategory.create({
      data: {
        code: `CAT-STEP9-${ts}`,
        name: 'Step9 Test Category',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Step9 Test Product ${ts}`,
        brandName: 'Brand 9',
        manufacturerName: 'Mfg 9 Ltd',
        categoryId: category.id,
      },
    });

    // 4. Rule & Version
    const rule = await prisma.rule.create({
      data: {
        code: `RULE-STEP9-MRP-${ts}`,
        name: 'MRP Presence (TEST FIXTURE)',
        description: 'MRP presence check fixture',
        category: 'PRICE',
        isActive: true,
      },
    });

    const rv = await prisma.ruleVersion.create({
      data: {
        ruleId: rule.id,
        version: 1,
        effectiveFrom: new Date('2025-01-01T00:00:00Z'),
        requirement: 'MRP declaration required.',
        validationType: 'EXISTS_AND_NON_ZERO',
        configuration: { field: 'mrp' },
      },
    });

    // 5. Inspections & Declarations
    // Inspection 1 (Inspector 1, UNDER_REVIEW)
    const insp1 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP9-UR1-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.UNDER_REVIEW,
        complianceStatus: ComplianceStatus.FAIL,
      },
    });
    inspectionUnderReview1Id = insp1.id;

    // Inspection 2 (Inspector 2, UNDER_REVIEW)
    const insp2 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP9-UR2-${ts}`,
        productId: product.id,
        createdBy: inspector2Id,
        workflowStatus: WorkflowStatus.UNDER_REVIEW,
        complianceStatus: ComplianceStatus.FAIL,
      },
    });
    inspectionUnderReview2Id = insp2.id;

    // Draft Inspection
    const inspDraft = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP9-DFT-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspectionDraftId = inspDraft.id;

    // Completed Inspection
    const inspComp = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP9-CMP-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    inspectionCompletedId = inspComp.id;

    // Declarations
    const decl1 = await prisma.declaration.create({
      data: {
        inspectionId: inspectionUnderReview1Id,
        type: DeclarationType.MRP,
        source: DeclarationSource.OCR,
        rawValue: 'MRP ₹100',
        confidence: 0.9,
      },
    });

    // Validation Results
    const valRes1 = await prisma.validationResult.create({
      data: {
        inspectionId: inspectionUnderReview1Id,
        ruleVersionId: rv.id,
        status: ValidationStatus.FAIL,
        message: 'MRP missing or non-compliant',
        confidence: 0.9,
      },
    });
    validationResult1Id = valRes1.id;

    const valRes2 = await prisma.validationResult.create({
      data: {
        inspectionId: inspectionUnderReview2Id,
        ruleVersionId: rv.id,
        status: ValidationStatus.FAIL,
        message: 'MRP non-compliant',
        confidence: 0.85,
      },
    });

    // Violations
    const viol1 = await prisma.violation.create({
      data: {
        inspectionId: inspectionUnderReview1Id,
        validationResultId: valRes1.id,
        code: 'VIO_MRP_MISSING',
        severity: ViolationSeverity.HIGH,
        title: 'Missing MRP Declaration',
        description: 'The mandatory MRP declaration was not detected.',
        status: ViolationStatus.OPEN,
      },
    });
    violation1Id = viol1.id;

    const viol2 = await prisma.violation.create({
      data: {
        inspectionId: inspectionUnderReview1Id,
        validationResultId: valRes1.id,
        code: 'VIO_QTY_UNITS',
        severity: ViolationSeverity.MEDIUM,
        title: 'Invalid Net Qty Unit',
        description: 'Non-standard unit used in declaration.',
        status: ViolationStatus.OPEN,
      },
    });
    violation2Id = viol2.id;

    await prisma.violation.create({
      data: {
        inspectionId: inspectionUnderReview2Id,
        validationResultId: valRes2.id,
        code: 'VIO_MRP_FORMAT',
        severity: ViolationSeverity.HIGH,
        title: 'Invalid MRP Format',
        description: 'Format does not follow LM rules.',
        status: ViolationStatus.OPEN,
      },
    });

    // Evidence
    await prisma.evidence.create({
      data: {
        violationId: viol1.id,
        declarationId: decl1.id,
        type: EvidenceType.DECLARATION,
        referenceId: decl1.id,
        metadata: { field: 'mrp' },
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step9.' } } } });
    await prisma.evidence.deleteMany({
      where: { violation: { inspection: { creator: { email: { contains: 'test.step9.' } } } } },
    });
    await prisma.violation.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.validationResult.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.declaration.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step9.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step9.' } } } });
    await prisma.ruleVersionCategory.deleteMany({ where: { category: { code: { contains: 'CAT-STEP9' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP9' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP9' } } });
    await prisma.ruleVersion.deleteMany({ where: { rule: { code: { contains: 'RULE-STEP9' } } } });
    await prisma.rule.deleteMany({ where: { code: { contains: 'RULE-STEP9' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step9.' } } });
    await prisma.$disconnect();
  });

  describe('Authentication & Access Controls', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get(
        `/api/inspections/${inspectionUnderReview1Id}/violations`
      );
      expect(res.status).toBe(401);
    });

    it('should FORBID Inspector 1 from viewing violations of Inspector 2 inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionUnderReview2Id}/violations`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should ALLOW Reviewer to view violations for any inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionUnderReview2Id}/violations`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('should ALLOW Admin to view violations for any inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionUnderReview1Id}/violations`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('Violation Query APIs & IDOR Protection', () => {
    it('GET /violations - should return paginated violations with filtering', async () => {
      const res = await request(app)
        .get(
          `/api/inspections/${inspectionUnderReview1Id}/violations?page=1&limit=1&status=OPEN&severity=HIGH`
        )
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.page).toBe(1);
    });

    it('GET /violations/:violationId - should retrieve single violation with evidence details', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionUnderReview1Id}/violations/${violation1Id}`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(violation1Id);
      expect(res.body.data.evidences.length).toBe(1);
      expect(res.body.data.validationResult).toBeDefined();
    });

    it('IDOR Check: should return 404 for violation belonging to Inspection 1 requested under Inspection 2 path', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionUnderReview2Id}/violations/${violation1Id}`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('VIOLATION_NOT_FOUND');
    });
  });

  describe('Validation Result Review APIs', () => {
    it('GET /validation-results - should list validation results for inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionUnderReview1Id}/validation-results`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(validationResult1Id);
    });

    it('GET /validation-results/:validationResultId - should retrieve single validation result', async () => {
      const res = await request(app)
        .get(
          `/api/inspections/${inspectionUnderReview1Id}/validation-results/${validationResult1Id}`
        )
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validationResult1Id);
    });

    it('IDOR Check: should return 404 for validation result mismatch across inspections', async () => {
      const res = await request(app)
        .get(
          `/api/inspections/${inspectionUnderReview2Id}/validation-results/${validationResult1Id}`
        )
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('VALIDATION_RESULT_NOT_FOUND');
    });
  });

  describe('Human Violation Status Transitions', () => {
    it('should FORBID Inspector from updating violation status with 403', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspectionUnderReview1Id}/violations/${violation1Id}/status`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ status: ViolationStatus.CONFIRMED });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should ALLOW Reviewer to transition violation from OPEN -> CONFIRMED', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspectionUnderReview1Id}/violations/${violation1Id}/status`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: ViolationStatus.CONFIRMED, comment: 'Confirmed by reviewer' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ViolationStatus.CONFIRMED);
    });

    it('should ALLOW Reviewer to transition violation from CONFIRMED -> RESOLVED and set resolvedAt timestamp', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspectionUnderReview1Id}/violations/${violation1Id}/status`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: ViolationStatus.RESOLVED, comment: 'Resolved after manual verification' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ViolationStatus.RESOLVED);
      expect(res.body.data.resolvedAt).not.toBeNull();
    });

    it('should reject invalid same-status transition with 400', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspectionUnderReview1Id}/violations/${violation1Id}/status`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: ViolationStatus.RESOLVED });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VIOLATION_STATUS_TRANSITION');
    });

    it('should reject updating violation status on COMPLETED inspection with 400', async () => {
      // First create a violation on COMPLETED inspection for test
      const tempViol = await prisma.violation.create({
        data: {
          inspectionId: inspectionCompletedId,
          validationResultId: validationResult1Id,
          code: 'VIO_TEMP',
          severity: ViolationSeverity.LOW,
          title: 'Temp Violation',
          description: 'Temp',
          status: ViolationStatus.OPEN,
        },
      });

      const res = await request(app)
        .patch(`/api/inspections/${inspectionCompletedId}/violations/${tempViol.id}/status`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: ViolationStatus.DISMISSED });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSPECTION_NOT_EDITABLE');
    });
  });

  describe('Human Review Workflow & Inspection Completion', () => {
    it('should FORBID Inspector from completing inspection review with 403', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionUnderReview1Id}/review`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ decision: 'APPROVE' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should REJECT inspection approval with 400 UNRESOLVED_VIOLATIONS if open violations remain', async () => {
      // violation2 is still OPEN
      const res = await request(app)
        .post(`/api/inspections/${inspectionUnderReview1Id}/review`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ decision: 'APPROVE', comments: 'Attempting approval' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNRESOLVED_VIOLATIONS');
    });

    it('should reject inspection review on DRAFT inspection with 400 INVALID_WORKFLOW_STATE', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionDraftId}/review`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ decision: 'APPROVE' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_WORKFLOW_STATE');
    });

    it('should ALLOW Reviewer to APPROVE inspection once all violations are resolved/dismissed', async () => {
      // Dismiss violation2 so 0 open violations remain (violation1 is RESOLVED, violation2 is DISMISSED)
      await request(app)
        .patch(`/api/inspections/${inspectionUnderReview1Id}/violations/${violation2Id}/status`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: ViolationStatus.DISMISSED, comment: 'Dismissing false alarm' });

      const res = await request(app)
        .post(`/api/inspections/${inspectionUnderReview1Id}/review`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ decision: 'APPROVE', comments: 'All violations verified and resolved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newWorkflowStatus).toBe(WorkflowStatus.COMPLETED);
      expect(res.body.data.newComplianceStatus).toBe(ComplianceStatus.PASS);

      // Verify DB inspection update
      const dbInsp = await prisma.inspection.findUnique({
        where: { id: inspectionUnderReview1Id },
      });
      expect(dbInsp?.workflowStatus).toBe(WorkflowStatus.COMPLETED);
      expect(dbInsp?.completedAt).not.toBeNull();
    });

    it('should ALLOW Reviewer to REQUEST_CHANGES on inspection, returning workflow status to DRAFT', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionUnderReview2Id}/review`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ decision: 'REQUEST_CHANGES', comments: 'Please re-upload clearer image' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newWorkflowStatus).toBe(WorkflowStatus.DRAFT);
    });
  });

  describe('Audit Logging Verification', () => {
    it('should verify audit log entries were recorded for violation status change and inspection review', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { user: { email: { contains: 'test.step9.' } } },
      });

      const statusChangedLog = logs.find((l) => l.action === 'VIOLATION_STATUS_CHANGED');
      const reviewCompletedLog = logs.find((l) => l.action === 'INSPECTION_REVIEW_COMPLETED');

      expect(statusChangedLog).toBeDefined();
      expect(reviewCompletedLog).toBeDefined();
    });
  });
});
