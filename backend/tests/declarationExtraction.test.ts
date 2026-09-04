import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { RoleCode, WorkflowStatus, OCRProcessingStatus, DeclarationType } from '@prisma/client';
import { generateToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

jest.setTimeout(30000);

describe('Step 7: OCR Attribute Extraction & Declaration Processing API Tests', () => {
  const ts = Date.now();
  const testPassword = 'StrongPassword123!';

  let inspector1Token: string;
  let inspector2Token: string;
  let adminToken: string;
  let reviewerToken: string;

  let inspector1Id: string;
  let inspector2Id: string;

  let inspection1Id: string;
  let inspection2Id: string;
  let completedInspectionId: string;

  let image1Id: string;
  let image2Id: string;

  let ocrSuccess1Id: string;
  let ocrPending1Id: string;
  let ocrFailed1Id: string;
  let ocrSuccess2Id: string;

  beforeAll(async () => {
    // Clean up test records
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step7.' } } } });
    await prisma.evidence.deleteMany({
      where: { declaration: { inspection: { creator: { email: { contains: 'test.step7.' } } } } },
    });
    await prisma.declaration.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step7.' } } } },
    });
    await prisma.oCRResult.deleteMany({
      where: { image: { inspection: { creator: { email: { contains: 'test.step7.' } } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step7.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step7.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP7' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP7' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step7.' } } });

    // 1. Roles
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

    // 2. Users
    const inspector1 = await prisma.user.create({
      data: {
        name: 'Step7 Inspector 1',
        email: `test.step7.inspector1.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector1Id = inspector1.id;
    inspector1Token = generateToken({ sub: inspector1.id, role: RoleCode.INSPECTOR });

    const inspector2 = await prisma.user.create({
      data: {
        name: 'Step7 Inspector 2',
        email: `test.step7.inspector2.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector2Id = inspector2.id;
    inspector2Token = generateToken({ sub: inspector2.id, role: RoleCode.INSPECTOR });

    const admin = await prisma.user.create({
      data: {
        name: 'Step7 Admin',
        email: `test.step7.admin.${ts}@example.com`,
        passwordHash: hash,
        roleId: adminRole.id,
      },
    });
    adminToken = generateToken({ sub: admin.id, role: RoleCode.ADMIN });

    const reviewer = await prisma.user.create({
      data: {
        name: 'Step7 Reviewer',
        email: `test.step7.reviewer.${ts}@example.com`,
        passwordHash: hash,
        roleId: reviewerRole.id,
      },
    });
    reviewerToken = generateToken({ sub: reviewer.id, role: RoleCode.REVIEWER });

    // 3. Category & Product
    const category = await prisma.productCategory.create({
      data: {
        code: `CAT-STEP7-${ts}`,
        name: 'Step7 Category',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Step7 Product ${ts}`,
        brandName: 'Brand 7',
        manufacturerName: 'Mfg 7 Ltd',
        categoryId: category.id,
      },
    });

    // 4. Inspections
    const insp1 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP7-1-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspection1Id = insp1.id;

    const insp2 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP7-2-${ts}`,
        productId: product.id,
        createdBy: inspector2Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspection2Id = insp2.id;

    const compInsp = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP7-COMP-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    completedInspectionId = compInsp.id;

    // 5. Images
    const img1 = await prisma.inspectionImage.create({
      data: {
        inspectionId: inspection1Id,
        fileUrl: 'https://mock.storage/img1.jpg',
        storageKey: `inspections/${inspection1Id}/img1.jpg`,
        originalFileName: 'label1.jpg',
        mimeType: 'image/jpeg',
        fileSize: 10240,
      },
    });
    image1Id = img1.id;

    const img2 = await prisma.inspectionImage.create({
      data: {
        inspectionId: inspection2Id,
        fileUrl: 'https://mock.storage/img2.jpg',
        storageKey: `inspections/${inspection2Id}/img2.jpg`,
        originalFileName: 'label2.jpg',
        mimeType: 'image/jpeg',
        fileSize: 10240,
      },
    });
    image2Id = img2.id;

    // 6. OCR Results
    const ocrSuccess1 = await prisma.oCRResult.create({
      data: {
        inspectionImageId: image1Id,
        provider: 'mock',
        rawText: `MRP ₹499.00 (Incl. of all taxes)\nNet Quantity: 500 g\nMfg Date: 06/2026\nExp Date: 06/2028\nManufactured by: ABC Foods Pvt Ltd, Delhi\nCountry of Origin: India\nConsumer Care: 1800-123-4567, support@abcfoods.com\nCommodity Name: Premium Packaged Rice`,
        confidence: 0.95,
        language: 'en',
        processingStatus: OCRProcessingStatus.SUCCESS,
      },
    });
    ocrSuccess1Id = ocrSuccess1.id;

    const ocrPending1 = await prisma.oCRResult.create({
      data: {
        inspectionImageId: image1Id,
        provider: 'mock',
        rawText: '',
        confidence: 0.0,
        language: 'en',
        processingStatus: OCRProcessingStatus.PENDING,
      },
    });
    ocrPending1Id = ocrPending1.id;

    const ocrFailed1 = await prisma.oCRResult.create({
      data: {
        inspectionImageId: image1Id,
        provider: 'mock',
        rawText: '',
        confidence: 0.0,
        language: 'en',
        processingStatus: OCRProcessingStatus.FAILED,
      },
    });
    ocrFailed1Id = ocrFailed1.id;

    const ocrSuccess2 = await prisma.oCRResult.create({
      data: {
        inspectionImageId: image2Id,
        provider: 'mock',
        rawText: `MRP Rs. 250.00\nNet Vol: 1 L\nImported by: XYZ Imports Ltd, Mumbai`,
        confidence: 0.92,
        language: 'en',
        processingStatus: OCRProcessingStatus.SUCCESS,
      },
    });
    ocrSuccess2Id = ocrSuccess2.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step7.' } } } });
    await prisma.evidence.deleteMany({
      where: { declaration: { inspection: { creator: { email: { contains: 'test.step7.' } } } } },
    });
    await prisma.declaration.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step7.' } } } },
    });
    await prisma.oCRResult.deleteMany({
      where: { image: { inspection: { creator: { email: { contains: 'test.step7.' } } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step7.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step7.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP7' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP7' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step7.' } } });
    await prisma.$disconnect();
  });

  describe('Authentication & Access Controls', () => {
    it('should reject unauthenticated extraction request with 401', async () => {
      const res = await request(app).post(
        `/api/inspections/${inspection1Id}/images/${image1Id}/ocr/${ocrSuccess1Id}/extract`
      );
      expect(res.status).toBe(401);
    });

    it('should FORBID Reviewer from triggering declaration extraction with 403', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/${ocrSuccess1Id}/extract`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should FORBID Inspector 1 from extracting declarations on Inspector 2 inspection with 403', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr/${ocrSuccess2Id}/extract`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should ALLOW Inspector 2 to extract declarations on own Inspection 2', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr/${ocrSuccess2Id}/extract`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('IDOR & Precondition Validations', () => {
    it('IDOR Check: should reject image belonging to Inspection 1 under Inspection 2 path (404)', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image1Id}/ocr/${ocrSuccess1Id}/extract`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('IMAGE_INSPECTION_MISMATCH');
    });

    it('IDOR Check: should reject OCR result belonging to Image 1 under Image 2 path (404)', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr/${ocrSuccess1Id}/extract`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('OCR_RESULT_IMAGE_MISMATCH');
    });

    it('should reject extraction on non-SUCCESS OCR result (PENDING status) with 400', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/${ocrPending1Id}/extract`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OCR_RESULT_NOT_SUCCESSFUL');
    });

    it('should reject extraction on non-SUCCESS OCR result (FAILED status) with 400', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/${ocrFailed1Id}/extract`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OCR_RESULT_NOT_SUCCESSFUL');
    });

    it('should reject extraction on COMPLETED inspection status with 400', async () => {
      // Create image & success OCR under COMPLETED inspection
      const compImg = await prisma.inspectionImage.create({
        data: {
          inspectionId: completedInspectionId,
          fileUrl: 'https://mock.storage/comp.jpg',
          storageKey: `inspections/${completedInspectionId}/comp.jpg`,
          originalFileName: 'comp.jpg',
          mimeType: 'image/jpeg',
          fileSize: 5000,
        },
      });

      const compOcr = await prisma.oCRResult.create({
        data: {
          inspectionImageId: compImg.id,
          provider: 'mock',
          rawText: 'MRP ₹100',
          confidence: 0.9,
          processingStatus: OCRProcessingStatus.SUCCESS,
        },
      });

      const res = await request(app)
        .post(
          `/api/inspections/${completedInspectionId}/images/${compImg.id}/ocr/${compOcr.id}/extract`
        )
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSPECTION_NOT_EDITABLE');
    });
  });

  describe('Attribute Extraction & Provenance Processing', () => {
    it('POST /extract - should extract structured declarations from OCR result', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/${ocrSuccess1Id}/extract`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const declarations = res.body.data;
      expect(Array.isArray(declarations)).toBe(true);
      expect(declarations.length).toBeGreaterThanOrEqual(7);

      // Verify MRP declaration
      const mrpDecl = declarations.find((d: any) => d.type === DeclarationType.MRP);
      expect(mrpDecl).toBeDefined();
      expect(mrpDecl.rawValue).toContain('MRP ₹499.00');
      const mrpNorm = JSON.parse(mrpDecl.normalizedValue);
      expect(mrpNorm.value).toBe(499);
      expect(mrpNorm.currency).toBe('INR');

      // Verify Net Quantity declaration
      const qtyDecl = declarations.find((d: any) => d.type === DeclarationType.NET_QUANTITY);
      expect(qtyDecl).toBeDefined();
      const qtyNorm = JSON.parse(qtyDecl.normalizedValue);
      expect(qtyNorm.value).toBe(500);
      expect(qtyNorm.unit).toBe('g');

      // Verify Mfg Date declaration
      const mfgDecl = declarations.find((d: any) => d.type === DeclarationType.MFG_DATE);
      expect(mfgDecl).toBeDefined();
      expect(mfgDecl.rawValue).toContain('06/2026');

      // Verify Country of Origin declaration
      const countryDecl = declarations.find((d: any) => d.type === DeclarationType.COUNTRY_OF_ORIGIN);
      expect(countryDecl).toBeDefined();
      expect(JSON.parse(countryDecl.normalizedValue).country).toBe('India');
    });

    it('GET /declarations - should retrieve all extracted declarations for an inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1Id}/declarations`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /declarations/:declarationId - should retrieve single declaration with IDOR check', async () => {
      const allRes = await request(app)
        .get(`/api/inspections/${inspection1Id}/declarations`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      const declId = allRes.body.data[0].id;

      const singleRes = await request(app)
        .get(`/api/inspections/${inspection1Id}/declarations/${declId}`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(singleRes.status).toBe(200);
      expect(singleRes.body.success).toBe(true);
      expect(singleRes.body.data.id).toBe(declId);

      // Request under wrong inspection ID -> 404 DECLARATION_INSPECTION_MISMATCH
      const idorRes = await request(app)
        .get(`/api/inspections/${inspection2Id}/declarations/${declId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(idorRes.status).toBe(404);
      expect(idorRes.body.error.code).toBe('DECLARATION_INSPECTION_MISMATCH');
    });

    it('POST /reextract - should re-extract idempotently without accumulating duplicate records', async () => {
      // Trigger re-extract
      const reextractRes = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/${ocrSuccess1Id}/reextract`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(reextractRes.status).toBe(200);
      expect(reextractRes.body.success).toBe(true);

      // Check DB records for this image - count should match extracted count, not double
      const dbDeclarations = await prisma.declaration.findMany({
        where: { inspectionId: inspection1Id, sourceImageId: image1Id },
      });

      expect(dbDeclarations.length).toBe(reextractRes.body.data.length);
    });
  });
});
