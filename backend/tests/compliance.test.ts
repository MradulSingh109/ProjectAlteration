import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import {
  RoleCode,
  WorkflowStatus,
  ComplianceStatus,
  DeclarationType,
  DeclarationSource,
  ViolationSeverity,
} from '@prisma/client';
import { generateToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

jest.setTimeout(30000);

describe('Step 8: Compliance Rule Engine & Validation API Tests', () => {
  const ts = Date.now();
  const testPassword = 'StrongPassword123!';

  let inspector1Token: string;
  let adminToken: string;
  let reviewerToken: string;

  let inspector1Id: string;
  let inspector2Id: string;

  let inspectionPassId: string;
  let inspectionFailId: string;
  let inspectionReviewId: string;
  let cancelledInspectionId: string;

  beforeAll(async () => {
    // 1. Clean up test records
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step8.' } } } });
    await prisma.evidence.deleteMany({
      where: { violation: { inspection: { creator: { email: { contains: 'test.step8.' } } } } },
    });
    await prisma.violation.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.validationResult.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.declaration.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step8.' } } } });
    await prisma.ruleVersionCategory.deleteMany({ where: { category: { code: { contains: 'CAT-STEP8' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP8' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP8' } } });
    await prisma.ruleVersion.deleteMany({ where: { rule: { code: { contains: 'RULE-STEP8' } } } });
    await prisma.rule.deleteMany({ where: { code: { contains: 'RULE-STEP8' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step8.' } } });

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
        name: 'Step8 Inspector 1',
        email: `test.step8.inspector1.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector1Id = inspector1.id;
    inspector1Token = generateToken({ sub: inspector1.id, role: RoleCode.INSPECTOR });

    const inspector2 = await prisma.user.create({
      data: {
        name: 'Step8 Inspector 2',
        email: `test.step8.inspector2.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector2Id = inspector2.id;

    const admin = await prisma.user.create({
      data: {
        name: 'Step8 Admin',
        email: `test.step8.admin.${ts}@example.com`,
        passwordHash: hash,
        roleId: adminRole.id,
      },
    });
    adminToken = generateToken({ sub: admin.id, role: RoleCode.ADMIN });

    const reviewer = await prisma.user.create({
      data: {
        name: 'Step8 Reviewer',
        email: `test.step8.reviewer.${ts}@example.com`,
        passwordHash: hash,
        roleId: reviewerRole.id,
      },
    });
    reviewerToken = generateToken({ sub: reviewer.id, role: RoleCode.REVIEWER });

    // 3. Category & Product
    const category = await prisma.productCategory.create({
      data: {
        code: `CAT-STEP8-${ts}`,
        name: 'Step8 Test Category',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Step8 Test Product ${ts}`,
        brandName: 'Brand 8',
        manufacturerName: 'Mfg 8 Ltd',
        categoryId: category.id,
      },
    });

    // 4. Rules & Versions (Test Fixtures Only)
    const ruleMrp = await prisma.rule.create({
      data: {
        code: `RULE-STEP8-MRP-${ts}`,
        name: 'MRP Declaration Check (TEST FIXTURE)',
        description: 'Test fixture rule for MRP presence and non-zero value',
        category: 'PRICE',
        isActive: true,
      },
    });

    const rvMrp = await prisma.ruleVersion.create({
      data: {
        ruleId: ruleMrp.id,
        version: 1,
        effectiveFrom: new Date('2025-01-01T00:00:00Z'),
        requirement: 'MRP must be clearly declared and greater than zero.',
        validationType: 'EXISTS_AND_NON_ZERO',
        configuration: { field: 'mrp', mustExist: true, currency: 'INR' },
      },
    });

    await prisma.ruleVersionCategory.create({
      data: { ruleVersionId: rvMrp.id, categoryId: category.id },
    });

    const ruleQty = await prisma.rule.create({
      data: {
        code: `RULE-STEP8-QTY-${ts}`,
        name: 'Net Quantity Unit Check (TEST FIXTURE)',
        description: 'Test fixture rule for standard net quantity units',
        category: 'QUANTITY',
        isActive: true,
      },
    });

    const rvQty = await prisma.ruleVersion.create({
      data: {
        ruleId: ruleQty.id,
        version: 1,
        effectiveFrom: new Date('2025-01-01T00:00:00Z'),
        requirement: 'Net quantity must be declared in standard units (g, kg, l, ml).',
        validationType: 'STANDARD_UNIT_MATCH',
        configuration: { field: 'netQuantity', mustExist: true },
      },
    });

    await prisma.ruleVersionCategory.create({
      data: { ruleVersionId: rvQty.id, categoryId: category.id },
    });

    // 5. Inspections
    // Inspection 1: PASS candidate
    const inspPass = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP8-PASS-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspectionPassId = inspPass.id;

    // Declarations for PASS inspection
    await prisma.declaration.createMany({
      data: [
        {
          inspectionId: inspectionPassId,
          type: DeclarationType.MRP,
          source: DeclarationSource.OCR,
          rawValue: 'MRP ₹499.00',
          normalizedValue: JSON.stringify({ value: 499, currency: 'INR' }),
          confidence: 0.95,
        },
        {
          inspectionId: inspectionPassId,
          type: DeclarationType.NET_QUANTITY,
          source: DeclarationSource.OCR,
          rawValue: 'Net Qty: 500 g',
          normalizedValue: JSON.stringify({ value: 500, unit: 'g' }),
          confidence: 0.94,
        },
      ],
    });

    // Inspection 2: FAIL candidate (Missing Net Quantity)
    const inspFail = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP8-FAIL-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspectionFailId = inspFail.id;

    // Declarations for FAIL inspection (MRP present, QTY missing)
    await prisma.declaration.create({
      data: {
        inspectionId: inspectionFailId,
        type: DeclarationType.MRP,
        source: DeclarationSource.OCR,
        rawValue: 'MRP ₹250.00',
        normalizedValue: JSON.stringify({ value: 250, currency: 'INR' }),
        confidence: 0.92,
      },
    });

    // Inspection 3: REVIEW candidate (Invalid non-standard unit)
    const inspReview = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP8-REV-${ts}`,
        productId: product.id,
        createdBy: inspector2Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspectionReviewId = inspReview.id;

    await prisma.declaration.createMany({
      data: [
        {
          inspectionId: inspectionReviewId,
          type: DeclarationType.MRP,
          source: DeclarationSource.OCR,
          rawValue: 'MRP ₹100.00',
          normalizedValue: JSON.stringify({ value: 100, currency: 'INR' }),
          confidence: 0.90,
        },
        {
          inspectionId: inspectionReviewId,
          type: DeclarationType.NET_QUANTITY,
          source: DeclarationSource.OCR,
          rawValue: 'Net Weight: 500 packets',
          normalizedValue: JSON.stringify({ value: 500, unit: 'packets' }), // 'packets' is non-standard unit -> FAIL/REVIEW
          confidence: 0.85,
        },
      ],
    });

    // Cancelled Inspection
    const inspCanc = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP8-CANC-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.CANCELLED,
      },
    });
    cancelledInspectionId = inspCanc.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step8.' } } } });
    await prisma.evidence.deleteMany({
      where: { violation: { inspection: { creator: { email: { contains: 'test.step8.' } } } } },
    });
    await prisma.violation.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.validationResult.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.declaration.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step8.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step8.' } } } });
    await prisma.ruleVersionCategory.deleteMany({ where: { category: { code: { contains: 'CAT-STEP8' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP8' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP8' } } });
    await prisma.ruleVersion.deleteMany({ where: { rule: { code: { contains: 'RULE-STEP8' } } } });
    await prisma.rule.deleteMany({ where: { code: { contains: 'RULE-STEP8' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step8.' } } });
    await prisma.$disconnect();
  });

  describe('Authentication & Access Controls', () => {
    it('should reject unauthenticated compliance request with 401', async () => {
      const res = await request(app).post(`/api/inspections/${inspectionPassId}/validate`);
      expect(res.status).toBe(401);
    });

    it('should FORBID Reviewer from triggering compliance evaluation with 403', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionPassId}/validate`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should FORBID Inspector 1 from validating Inspector 2 inspection with 403', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionReviewId}/validate`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should ALLOW Inspector 1 to validate own inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionPassId}/validate`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.complianceStatus).toBe(ComplianceStatus.PASS);
    });

    it('should ALLOW Admin to validate any inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionPassId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Workflow & Precondition Restrictions', () => {
    it('should reject compliance validation on CANCELLED inspection status with 400', async () => {
      const res = await request(app)
        .post(`/api/inspections/${cancelledInspectionId}/validate`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_NOT_ALLOWED');
    });

    it('should return 404 for compliance validation on non-existent inspection ID', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000000';
      const res = await request(app)
        .post(`/api/inspections/${fakeId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });
  });

  describe('Deterministic Compliance Evaluation & Violation Persistence', () => {
    it('POST /validate - should evaluate compliant declarations to PASS status with 0 violations', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionPassId}/validate`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      expect(summary.complianceStatus).toBe(ComplianceStatus.PASS);
      expect(summary.summary.passedCount).toBe(2);
      expect(summary.summary.failedCount).toBe(0);
      expect(summary.summary.violationCount).toBe(0);

      // Verify DB update
      const dbInsp = await prisma.inspection.findUnique({ where: { id: inspectionPassId } });
      expect(dbInsp?.complianceStatus).toBe(ComplianceStatus.PASS);
    });

    it('POST /validate - should evaluate missing Net Quantity declaration to FAIL status and create Violation', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspectionFailId}/validate`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      expect(summary.complianceStatus).toBe(ComplianceStatus.FAIL);
      expect(summary.summary.passedCount).toBe(1); // MRP passed
      expect(summary.summary.failedCount).toBe(1); // QTY failed
      expect(summary.summary.violationCount).toBe(1);

      // Verify DB Violation record
      const dbViolations = await prisma.violation.findMany({
        where: { inspectionId: inspectionFailId },
      });
      expect(dbViolations.length).toBe(1);
      expect(dbViolations[0].severity).toBe(ViolationSeverity.HIGH);
      expect(dbViolations[0].title).toContain('Missing Net Quantity');
    });
  });

  describe('Retrieval Endpoints & IDOR Protection', () => {
    it('GET /validation-results - should allow Reviewer to view inspection validation results', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionPassId}/validation-results`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('GET /violations - should allow Reviewer to view inspection violations with evidence details', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionFailId}/violations`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('GET /compliance - should allow Inspector 1 to get overall compliance summary for own inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionFailId}/compliance`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.complianceStatus).toBe(ComplianceStatus.FAIL);
    });

    it('IDOR Check: should FORBID Inspector 1 from retrieving violations of Inspector 2 inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspectionReviewId}/violations`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Re-Evaluation Idempotency & Transaction Safety', () => {
    it('should re-evaluate multiple times without accumulating duplicate validation results or violations', async () => {
      // Re-trigger validation on FAIL inspection
      const res1 = await request(app)
        .post(`/api/inspections/${inspectionFailId}/validate`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post(`/api/inspections/${inspectionFailId}/validate`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res2.status).toBe(200);

      // Verify exact DB counts (not accumulated)
      const resultsInDb = await prisma.validationResult.findMany({
        where: { inspectionId: inspectionFailId },
      });
      const violationsInDb = await prisma.violation.findMany({
        where: { inspectionId: inspectionFailId },
      });

      expect(resultsInDb.length).toBe(2);
      expect(violationsInDb.length).toBe(1);
    });
  });
});
