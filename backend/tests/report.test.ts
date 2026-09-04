import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import {
  RoleCode,
  WorkflowStatus,
  ComplianceStatus,
  ValidationStatus,
  ViolationSeverity,
  ViolationStatus,
  DeclarationType,
  DeclarationSource,
  EvidenceType,
  ReportType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

jest.setTimeout(30000);

describe('Step 10: Compliance Results & Report Generation API Tests', () => {
  let adminToken: string;
  let reviewerToken: string;
  let inspector1Token: string;
  let inspector2Token: string;

  let adminUser: any;
  let reviewerUser: any;
  let inspector1User: any;
  let inspector2User: any;

  let productCategory: any;
  let product: any;

  let inspection1: any;
  let inspection2: any;

  let image1: any;
  let ocrResult1: any;
  let declaration1: any;
  let declaration2: any;

  let rule: any;
  let ruleVersion: any;
  let validationResult1: any;
  let violation1: any;
  let evidence1: any;

  let generatedReportId: string;

  beforeAll(async () => {
    // 1. Fetch system roles
    const adminRole = await prisma.role.findUnique({ where: { code: RoleCode.ADMIN } });
    const reviewerRole = await prisma.role.findUnique({ where: { code: RoleCode.REVIEWER } });
    const inspectorRole = await prisma.role.findUnique({ where: { code: RoleCode.INSPECTOR } });

    if (!adminRole || !reviewerRole || !inspectorRole) {
      throw new Error('Database roles not initialized. Run seed before running tests.');
    }

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // 2. Create test users
    adminUser = await prisma.user.create({
      data: {
        email: `admin-rep-${Date.now()}@example.com`,
        passwordHash: hashedPassword,
        name: 'Report Admin User',
        roleId: adminRole.id,
      },
    });

    reviewerUser = await prisma.user.create({
      data: {
        email: `reviewer-rep-${Date.now()}@example.com`,
        passwordHash: hashedPassword,
        name: 'Report Reviewer User',
        roleId: reviewerRole.id,
      },
    });

    inspector1User = await prisma.user.create({
      data: {
        email: `inspector1-rep-${Date.now()}@example.com`,
        passwordHash: hashedPassword,
        name: 'Report Inspector One',
        roleId: inspectorRole.id,
      },
    });

    inspector2User = await prisma.user.create({
      data: {
        email: `inspector2-rep-${Date.now()}@example.com`,
        passwordHash: hashedPassword,
        name: 'Report Inspector Two',
        roleId: inspectorRole.id,
      },
    });

    // 3. Issue JWT tokens
    adminToken = jwt.sign(
      { sub: adminUser.id, email: adminUser.email, role: RoleCode.ADMIN },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    reviewerToken = jwt.sign(
      { sub: reviewerUser.id, email: reviewerUser.email, role: RoleCode.REVIEWER },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    inspector1Token = jwt.sign(
      { sub: inspector1User.id, email: inspector1User.email, role: RoleCode.INSPECTOR },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    inspector2Token = jwt.sign(
      { sub: inspector2User.id, email: inspector2User.email, role: RoleCode.INSPECTOR },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 4. Create product category & product
    productCategory = await prisma.productCategory.create({
      data: {
        code: `CAT-REP-${Date.now()}`,
        name: 'Report Test Package Category',
      },
    });

    product = await prisma.product.create({
      data: {
        name: 'Report Test Organic Oats 1kg',
        brandName: 'NutriReport',
        manufacturerName: 'NutriReport Foods Pvt Ltd',
        categoryId: productCategory.id,
      },
    });

    // 5. Create Inspection 1 (Inspector 1) & Inspection 2 (Inspector 2)
    inspection1 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-REP1-${Date.now()}`,
        productId: product.id,
        createdBy: inspector1User.id,
        workflowStatus: WorkflowStatus.COMPLETED,
        complianceStatus: ComplianceStatus.FAIL,
        remarks: 'Report test inspection with violations',
        completedAt: new Date(),
      },
    });

    inspection2 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-REP2-${Date.now()}`,
        productId: product.id,
        createdBy: inspector2User.id,
        workflowStatus: WorkflowStatus.DRAFT,
        complianceStatus: ComplianceStatus.REVIEW,
        remarks: 'Report test draft inspection',
      },
    });

    // 6. Populate image, OCR result & declarations for Inspection 1
    image1 = await prisma.inspectionImage.create({
      data: {
        inspectionId: inspection1.id,
        fileUrl: `https://supabase.co/storage/v1/object/public/test/report-${Date.now()}.jpg`,
        storageKey: `inspections/${inspection1.id}/report-image.jpg`,
        originalFileName: 'package_front.jpg',
        mimeType: 'image/jpeg',
        fileSize: 102450,
      },
    });

    ocrResult1 = await prisma.oCRResult.create({
      data: {
        inspectionImageId: image1.id,
        provider: 'mock-ocr',
        rawText: 'MRP Rs. 299.00\nNet Qty: 1 kg\nMfg Date: 01/2026',
        confidence: 0.96,
        processingStatus: 'SUCCESS',
      },
    });

    declaration1 = await prisma.declaration.create({
      data: {
        inspectionId: inspection1.id,
        type: DeclarationType.MRP,
        source: DeclarationSource.OCR,
        rawValue: 'MRP Rs. 299.00',
        normalizedValue: JSON.stringify({ value: 299, currency: 'INR' }),
        confidence: 0.98,
        sourceImageId: image1.id,
      },
    });

    declaration2 = await prisma.declaration.create({
      data: {
        inspectionId: inspection1.id,
        type: DeclarationType.NET_QUANTITY,
        source: DeclarationSource.OCR,
        rawValue: 'Net Qty: 1 kg',
        normalizedValue: JSON.stringify({ value: 1000, unit: 'g' }),
        confidence: 0.95,
        sourceImageId: image1.id,
      },
    });

    // 7. Create Rule, RuleVersion, ValidationResult & Violation for Inspection 1
    rule = await prisma.rule.create({
      data: {
        code: `R-REP-${Date.now()}`,
        name: 'Report Test Mandatory Declaration Check',
        category: 'PACKAGED_COMMODITY',
      },
    });

    ruleVersion = await prisma.ruleVersion.create({
      data: {
        ruleId: rule.id,
        version: 1,
        effectiveFrom: new Date('2020-01-01'),
        requirement: 'Package must display valid MRP in INR currency',
        validationType: 'EXISTS_AND_NON_ZERO',
      },
    });

    validationResult1 = await prisma.validationResult.create({
      data: {
        inspectionId: inspection1.id,
        ruleVersionId: ruleVersion.id,
        status: ValidationStatus.FAIL,
        message: 'MRP declaration missing required currency formatting symbol',
        confidence: 0.92,
      },
    });

    violation1 = await prisma.violation.create({
      data: {
        inspectionId: inspection1.id,
        validationResultId: validationResult1.id,
        code: rule.code,
        severity: ViolationSeverity.HIGH,
        title: 'Improper MRP Formatting',
        description: 'MRP formatting on package front does not comply with Rule 6',
        status: ViolationStatus.CONFIRMED,
      },
    });

    evidence1 = await prisma.evidence.create({
      data: {
        violationId: violation1.id,
        imageId: image1.id,
        ocrResultId: ocrResult1.id,
        declarationId: declaration1.id,
        type: EvidenceType.IMAGE,
        metadata: { x: 10, y: 20, width: 100, height: 30 },
      },
    });

    expect(inspector2Token).toBeDefined();
    expect(declaration2.id).toBeDefined();
    expect(evidence1.id).toBeDefined();

    // 8. Create audit log for human review action on Inspection 1
    await prisma.auditLog.create({
      data: {
        userId: reviewerUser.id,
        action: 'INSPECTION_REVIEW_COMPLETED',
        entityType: 'Inspection',
        entityId: inspection1.id,
        newValue: {
          decision: 'REJECT',
          workflowStatus: 'COMPLETED',
          complianceStatus: 'FAIL',
          remarks: 'Confirmed 1 high-severity violation regarding MRP format.',
        },
      },
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup created records in reverse order
    await prisma.report.deleteMany({
      where: { inspectionId: { in: [inspection1.id, inspection2.id] } },
    });
    await prisma.evidence.deleteMany({ where: { violationId: violation1.id } });
    await prisma.violation.deleteMany({ where: { id: violation1.id } });
    await prisma.validationResult.deleteMany({ where: { id: validationResult1.id } });
    await prisma.ruleVersion.deleteMany({ where: { id: ruleVersion.id } });
    await prisma.rule.deleteMany({ where: { id: rule.id } });
    await prisma.declaration.deleteMany({
      where: { inspectionId: { in: [inspection1.id, inspection2.id] } },
    });
    await prisma.oCRResult.deleteMany({ where: { id: ocrResult1.id } });
    await prisma.inspectionImage.deleteMany({ where: { id: image1.id } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [inspection1.id, inspection2.id] } },
    });
    await prisma.inspection.deleteMany({
      where: { id: { in: [inspection1.id, inspection2.id] } },
    });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.productCategory.deleteMany({ where: { id: productCategory.id } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUser.id, reviewerUser.id, inspector1User.id, inspector2User.id] },
      },
    });
  });

  // ==========================================
  // 1. AUTHENTICATION & ACCESS CONTROLS
  // ==========================================
  describe('Authentication & Access Controls', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get(`/api/inspections/${inspection1.id}/compliance-summary`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should FORBID Inspector 1 from viewing compliance summary of Inspector 2 inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection2.id}/compliance-summary`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should ALLOW Inspector 1 to view compliance summary for own inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/compliance-summary`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection.id).toBe(inspection1.id);
    });

    it('should ALLOW Reviewer to view compliance summary for any inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/compliance-summary`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should ALLOW Admin to view compliance summary for any inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection2.id}/compliance-summary`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 2. COMPLIANCE SUMMARY API
  // ==========================================
  describe('GET /api/inspections/:id/compliance-summary', () => {
    it('should return complete compliance summary with breakdown data', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/compliance-summary`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      expect(summary.inspection.id).toBe(inspection1.id);
      expect(summary.inspection.workflowStatus).toBe('COMPLETED');
      expect(summary.product.name).toBe('Report Test Organic Oats 1kg');
      expect(summary.product.category.code).toBe(productCategory.code);

      // Declarations summary
      expect(summary.declarationSummary.total).toBe(2);
      expect(summary.declarationSummary.byType.MRP).toBe(1);
      expect(summary.declarationSummary.byType.NET_QUANTITY).toBe(1);

      // Validation summary
      expect(summary.validationSummary.total).toBe(1);
      expect(summary.validationSummary.failCount).toBe(1);

      // Violation summary
      expect(summary.violationSummary.total).toBe(1);
      expect(summary.violationSummary.bySeverity.HIGH).toBe(1);
      expect(summary.violationSummary.byStatus.CONFIRMED).toBe(1);

      // Review summary
      expect(summary.reviewSummary.latestDecision).toBe('REJECT');
      expect(summary.reviewSummary.reviewedBy.id).toBe(reviewerUser.id);
      expect(summary.evidenceReferencesCount).toBe(1);
    });

    it('should return 404 for non-existent inspection ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/inspections/${nonExistentId}/compliance-summary`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });
  });

  // ==========================================
  // 3. COMPLIANCE RESULT API
  // ==========================================
  describe('GET /api/inspections/:id/compliance-result', () => {
    it('should distinguish automated status, human review decision, and final status', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/compliance-result`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const result = res.body.data;
      expect(result.inspectionId).toBe(inspection1.id);
      expect(result.automatedEvaluation.complianceStatus).toBe('FAIL');
      expect(result.automatedEvaluation.totalRulesEvaluated).toBe(1);
      expect(result.automatedEvaluation.failCount).toBe(1);

      expect(result.humanReview.isReviewed).toBe(true);
      expect(result.humanReview.latestDecision).toBe('REJECT');
      expect(result.humanReview.reviewedBy.id).toBe(reviewerUser.id);

      expect(result.finalComplianceStatus).toBe('FAIL');
      expect(result.workflowStatus).toBe('COMPLETED');
    });

    it('IDOR Check: should return 403 when Inspector 1 requests Inspector 2 compliance result', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection2.id}/compliance-result`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // 4. REPORT DATA & PERSISTENCE APIs
  // ==========================================
  describe('Report Data & Persistence APIs', () => {
    it('GET /report - should return complete structured report JSON without persisting', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/report`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const reportData = res.body.data;
      expect(reportData.inspection.id).toBe(inspection1.id);
      expect(reportData.product.id).toBe(product.id);
      expect(reportData.declarations.length).toBe(2);
      expect(reportData.validationResults.length).toBe(1);
      expect(reportData.violations.length).toBe(1);
      expect(reportData.evidence.totalImages).toBe(1);
      expect(reportData.review.latestDecision).toBe('REJECT');
      expect(reportData.generatedAt).toBeDefined();
    });

    it('POST /reports - should create and persist a Report record with audit log', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1.id}/reports`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          reportType: ReportType.FULL_COMPLIANCE,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const { report, reportData } = res.body.data;
      expect(report.id).toBeDefined();
      expect(report.inspectionId).toBe(inspection1.id);
      expect(report.reportType).toBe('FULL_COMPLIANCE');
      expect(report.generatedBy.id).toBe(reviewerUser.id);
      expect(reportData.inspection.id).toBe(inspection1.id);

      generatedReportId = report.id;

      // Verify AuditLog entry was recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'REPORT_GENERATED',
          entityId: generatedReportId,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(reviewerUser.id);
    });

    it('GET /report?persist=true - should persist report record when query flag is provided', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/report?persist=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.id).toBeDefined();
      expect(res.body.data.report.generatedBy.id).toBe(adminUser.id);
    });
  });

  // ==========================================
  // 5. REPORT HISTORY & INDIVIDUAL LOOKUP
  // ==========================================
  describe('Report History & Individual Lookup', () => {
    it('GET /reports - should list generated report history for inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/reports`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /reports/:reportId - should retrieve single report by ID', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/reports/${generatedReportId}`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { report, reportData } = res.body.data;
      expect(report.id).toBe(generatedReportId);
      expect(reportData.inspection.id).toBe(inspection1.id);
    });

    it('IDOR Check: should return 404 when reportId is requested under wrong inspection path', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection2.id}/reports/${generatedReportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('REPORT_NOT_FOUND');
    });
  });

  // ==========================================
  // 6. COMPLIANCE DASHBOARD SUMMARY
  // ==========================================
  describe('GET /api/reports/summary (Compliance Dashboard Summary)', () => {
    it('should return system-wide aggregate stats for Admin user', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      expect(summary.inspections.total).toBeGreaterThanOrEqual(2);
      expect(summary.compliance).toBeDefined();
      expect(summary.violations).toBeDefined();
      expect(summary.violations.bySeverity.HIGH).toBeGreaterThanOrEqual(1);
    });

    it('should return Inspector-scoped aggregate stats for Inspector 1', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      // Inspector 1 created Inspection 1 only
      expect(summary.inspections.total).toBe(1);
      expect(summary.inspections.completed).toBe(1);
      expect(summary.compliance.fail).toBe(1);
    });
  });

  // ==========================================
  // 7. SECURITY & PRIVACY SANITIZATION
  // ==========================================
  describe('Security & Privacy Checks', () => {
    it('should NOT leak passwordHash, JWT secret, or internal auth credentials in report payload', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1.id}/report`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      const jsonStr = JSON.stringify(res.body);

      expect(jsonStr).not.toContain('passwordHash');
      expect(jsonStr).not.toContain(env.JWT_SECRET);
      expect(jsonStr).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    });
  });
});
