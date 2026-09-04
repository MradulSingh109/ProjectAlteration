import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { RoleCode, WorkflowStatus, OCRProcessingStatus } from '@prisma/client';
import { generateToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';
import { env } from '../src/config/env';

jest.setTimeout(30000);

describe('Step 6A: Backend OCR Integration Layer API Tests', () => {
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
  let completedInspectionImageId: string;

  beforeAll(async () => {
    // Clean up test records in reverse foreign key order
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step6a.' } } } });
    await prisma.oCRResult.deleteMany({
      where: { image: { inspection: { creator: { email: { contains: 'test.step6a.' } } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step6a.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step6a.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP6A' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP6A' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step6a.' } } });

    // 1. Ensure Roles
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

    // 2. Create Test Users
    const inspector1 = await prisma.user.create({
      data: {
        name: 'Step6A Inspector 1',
        email: `test.step6a.inspector1.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector1Id = inspector1.id;
    inspector1Token = generateToken({ sub: inspector1.id, role: RoleCode.INSPECTOR });

    const inspector2 = await prisma.user.create({
      data: {
        name: 'Step6A Inspector 2',
        email: `test.step6a.inspector2.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector2Id = inspector2.id;
    inspector2Token = generateToken({ sub: inspector2.id, role: RoleCode.INSPECTOR });

    const admin = await prisma.user.create({
      data: {
        name: 'Step6A Admin',
        email: `test.step6a.admin.${ts}@example.com`,
        passwordHash: hash,
        roleId: adminRole.id,
      },
    });
    adminToken = generateToken({ sub: admin.id, role: RoleCode.ADMIN });

    const reviewer = await prisma.user.create({
      data: {
        name: 'Step6A Reviewer',
        email: `test.step6a.reviewer.${ts}@example.com`,
        passwordHash: hash,
        roleId: reviewerRole.id,
      },
    });
    reviewerToken = generateToken({ sub: reviewer.id, role: RoleCode.REVIEWER });

    // 3. Category & Product
    const category = await prisma.productCategory.create({
      data: {
        code: `CAT-STEP6A-${ts}`,
        name: 'Step6A Product Category',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Step6A Test Product ${ts}`,
        brandName: 'Brand 6A',
        manufacturerName: 'Mfg 6A Ltd',
        categoryId: category.id,
      },
    });

    // 4. Create Test Inspections
    const insp1 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP6A-1-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspection1Id = insp1.id;

    const insp2 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP6A-2-${ts}`,
        productId: product.id,
        createdBy: inspector2Id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspection2Id = insp2.id;

    const completedInsp = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP6A-COMP-${ts}`,
        productId: product.id,
        createdBy: inspector1Id,
        workflowStatus: WorkflowStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    completedInspectionId = completedInsp.id;

    // 5. Create Inspection Images
    const img1 = await prisma.inspectionImage.create({
      data: {
        inspectionId: inspection1Id,
        fileUrl: 'https://mock.supabase.co/storage/v1/object/public/inspection-images/inspections/img1.jpg',
        storageKey: `inspections/${inspection1Id}/img1.jpg`,
        originalFileName: 'label-front.jpg',
        mimeType: 'image/jpeg',
        fileSize: 10240,
        imageType: 'FRONT',
      },
    });
    image1Id = img1.id;

    const img2 = await prisma.inspectionImage.create({
      data: {
        inspectionId: inspection2Id,
        fileUrl: 'https://mock.supabase.co/storage/v1/object/public/inspection-images/inspections/img2.jpg',
        storageKey: `inspections/${inspection2Id}/img2.jpg`,
        originalFileName: 'label-back.jpg',
        mimeType: 'image/jpeg',
        fileSize: 12000,
        imageType: 'BACK',
      },
    });
    image2Id = img2.id;

    const compImg = await prisma.inspectionImage.create({
      data: {
        inspectionId: completedInspectionId,
        fileUrl: 'https://mock.supabase.co/storage/v1/object/public/inspection-images/inspections/comp.jpg',
        storageKey: `inspections/${completedInspectionId}/comp.jpg`,
        originalFileName: 'label-completed.jpg',
        mimeType: 'image/jpeg',
        fileSize: 15000,
        imageType: 'FRONT',
      },
    });
    completedInspectionImageId = compImg.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step6a.' } } } });
    await prisma.oCRResult.deleteMany({
      where: { image: { inspection: { creator: { email: { contains: 'test.step6a.' } } } } },
    });
    await prisma.inspectionImage.deleteMany({
      where: { inspection: { creator: { email: { contains: 'test.step6a.' } } } },
    });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step6a.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP6A' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP6A' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step6a.' } } });
    await prisma.$disconnect();
  });

  describe('Authentication & Access Controls', () => {
    it('POST /api/inspections/:id/images/:imageId/ocr - should reject unauthenticated request', async () => {
      const res = await request(app).post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/inspections/:id/images/:imageId/ocr - should reject unauthenticated request', async () => {
      const res = await request(app).get(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr`);
      expect(res.status).toBe(401);
    });

    it('GET /api/inspections/:id/images/:imageId/ocr/status - should reject unauthenticated request', async () => {
      const res = await request(app).get(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/status`);
      expect(res.status).toBe(401);
    });

    it('should FORBID Reviewer from triggering OCR', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should FORBID Inspector 1 from triggering OCR on Inspector 2 inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('IDOR & Parameter Validation', () => {
    it('IDOR Check: should reject image belonging to Inspection 1 requested under Inspection 2 path', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image1Id}/ocr`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('IMAGE_INSPECTION_MISMATCH');
    });

    it('should return 404 for non-existent inspection ID', async () => {
      const res = await request(app)
        .post(`/api/inspections/00000000-0000-0000-0000-000000000000/images/${image1Id}/ocr`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });

    it('should return 404 for non-existent image ID', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/00000000-0000-0000-0000-000000000000/ocr`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('IMAGE_NOT_FOUND');
    });
  });

  describe('Workflow Status Restrictions', () => {
    it('should reject OCR request on COMPLETED inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${completedInspectionId}/images/${completedInspectionImageId}/ocr`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSPECTION_NOT_ELIGIBLE');
    });
  });

  describe('Mock Provider Execution, Provenance History & Status API', () => {
    it('GET /status before running OCR - should return NOT_STARTED status', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/status`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('NOT_STARTED');
    });

    it('POST /ocr - should trigger Mock OCR provider and create SUCCESS OCRResult', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const ocr = res.body.data;
      expect(ocr.id).toBeDefined();
      expect(ocr.inspectionImageId).toBe(image1Id);
      expect(ocr.processingStatus).toBe('SUCCESS');
      expect(ocr.provider).toBe('mock');
      expect(ocr.rawText).toContain('MRP ₹499.00');
      expect(ocr.confidence).toBeGreaterThan(0.9);

      // Verify Audit Log records
      const auditStart = await prisma.auditLog.findFirst({
        where: { entityType: 'OCRResult', entityId: ocr.id, action: 'OCR_PROCESSING_STARTED' },
      });
      expect(auditStart).toBeDefined();

      const auditComplete = await prisma.auditLog.findFirst({
        where: { entityType: 'OCRResult', entityId: ocr.id, action: 'OCR_PROCESSING_COMPLETED' },
      });
      expect(auditComplete).toBeDefined();
    });

    it('GET /ocr - should return list of OCR results', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].processingStatus).toBe('SUCCESS');
    });

    it('GET /status - should return SUCCESS status', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/status`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUCCESS');
      expect(res.body.data.provider).toBe('mock');
    });

    it('POST /reprocess - should create a SECOND OCRResult preserving historical provenance', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images/${image1Id}/ocr/reprocess`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Fetch all results directly from DB
      const dbResults = await prisma.oCRResult.findMany({
        where: { inspectionImageId: image1Id },
      });
      expect(dbResults.length).toBe(2);
    });
  });

  describe('Concurrency & Pending Lock Protection', () => {
    it('should return 409 Conflict if an OCR request is already in PENDING state', async () => {
      // Create a dummy pending OCR result record directly in DB
      const pendingRecord = await prisma.oCRResult.create({
        data: {
          inspectionImageId: image2Id,
          provider: 'mock',
          rawText: '',
          confidence: 0.0,
          language: 'en',
          processingStatus: OCRProcessingStatus.PENDING,
        },
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OCR_ALREADY_PROCESSING');

      // Cleanup dummy pending record
      await prisma.oCRResult.delete({ where: { id: pendingRecord.id } });
    });
  });

  describe('HTTP Provider Execution & Failure Modes', () => {
    const originalProvider = env.OCR_PROVIDER;
    const originalUrl = env.OCR_SERVICE_URL;

    beforeAll(() => {
      (env as any).OCR_PROVIDER = 'http';
      (env as any).OCR_SERVICE_URL = 'https://mock-ai-ocr-service.internal/ocr';
    });

    afterAll(() => {
      (env as any).OCR_PROVIDER = originalProvider;
      (env as any).OCR_SERVICE_URL = originalUrl;
    });

    it('should handle HTTP Timeout (504 Gateway Timeout) and set DB status to FAILED', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        const err: any = new Error('The operation was aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(504);
      expect(res.body.error.code).toBe('OCR_PROVIDER_TIMEOUT');

      const dbOcr = await prisma.oCRResult.findFirst({
        where: { inspectionImageId: image2Id },
        orderBy: { createdAt: 'desc' },
      });
      expect(dbOcr?.processingStatus).toBe('FAILED');

      fetchSpy.mockRestore();
    });

    it('should handle Network Failure (502 Bad Gateway) and set DB status to FAILED', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:8080'));
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('OCR_PROVIDER_UNAVAILABLE');

      fetchSpy.mockRestore();
    });

    it('should handle HTTP 500 error status from external AI service (502 Bad Gateway)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('OCR_PROVIDER_UNAVAILABLE');

      fetchSpy.mockRestore();
    });

    it('should handle invalid JSON schema response from external AI service (502 Bad Gateway)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              rawText: 12345, // invalid, should be string
              confidence: 'very-high', // invalid, should be number
            }),
        } as Response);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('OCR_PROVIDER_INVALID_RESPONSE');

      fetchSpy.mockRestore();
    });

    it('should successfully parse valid external HTTP OCR response', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                rawText: 'NET QUANTITY 1 kg\nMRP RS 250.00',
                confidence: 0.92,
                language: 'eng',
                provider: 'external-ai-ocr',
                processingTimeMs: 420,
              },
            }),
        } as Response);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processingStatus).toBe('SUCCESS');
      expect(res.body.data.provider).toBe('external-ai-ocr');
      expect(res.body.data.rawText).toContain('NET QUANTITY 1 kg');

      fetchSpy.mockRestore();
    });
  });

  describe('Step 6B: Normalization, Confidence Scaling & Bounding Box Validation', () => {
    const originalProvider = env.OCR_PROVIDER;
    const originalUrl = env.OCR_SERVICE_URL;

    beforeAll(() => {
      (env as any).OCR_PROVIDER = 'http';
      (env as any).OCR_SERVICE_URL = 'https://mock-ai-ocr-service.internal/ocr';
    });

    afterAll(() => {
      (env as any).OCR_PROVIDER = originalProvider;
      (env as any).OCR_SERVICE_URL = originalUrl;
    });

    it('should normalize 0..100 confidence scale to 0..1 scale (e.g. 95.5 -> 0.955)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              rawText: 'MRP Rs 150',
              confidence: 95.5, // scale 0-100
              language: 'en',
              provider: 'scale-test-ocr',
            }),
        } as Response);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.confidence).toBe(0.955);

      fetchSpy.mockRestore();
    });

    it('should reject invalid confidence > 100 with OCR_INVALID_CONFIDENCE and mark status FAILED', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              rawText: 'Test text',
              confidence: 250, // invalid out of bounds
              language: 'en',
              provider: 'invalid-conf-ocr',
            }),
        } as Response);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('OCR_INVALID_CONFIDENCE');

      const dbOcr = await prisma.oCRResult.findFirst({
        where: { inspectionImageId: image2Id },
        orderBy: { createdAt: 'desc' },
      });
      expect(dbOcr?.processingStatus).toBe('FAILED');

      fetchSpy.mockRestore();
    });

    it('should reject negative bounding box coordinates with OCR_INVALID_BOUNDING_BOXES and mark status FAILED', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              rawText: 'Test text',
              confidence: 0.9,
              language: 'en',
              provider: 'negative-bb-ocr',
              boundingBoxes: [
                { text: 'MRP', x: -10, y: 20, width: 50, height: 30 }, // invalid x < 0
              ],
            }),
        } as Response);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('OCR_INVALID_BOUNDING_BOXES');

      const dbOcr = await prisma.oCRResult.findFirst({
        where: { inspectionImageId: image2Id },
        orderBy: { createdAt: 'desc' },
      });
      expect(dbOcr?.processingStatus).toBe('FAILED');

      fetchSpy.mockRestore();
    });

    it('should sanitize metadata to strip secret token keys', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              rawText: 'Clean text',
              confidence: 0.88,
              language: 'en',
              provider: 'sanitize-test-ocr',
              metadata: {
                model: 'v1.2',
                authorization: 'Bearer super-secret-token', // sensitive key to strip
                authToken: 'secret-123',
                device: 'gpu-0',
              },
            }),
        } as Response);
      });

      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images/${image2Id}/ocr`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const dbOcr = await prisma.oCRResult.findFirst({
        where: { inspectionImageId: image2Id },
        orderBy: { createdAt: 'desc' },
      });
      expect(dbOcr?.processingStatus).toBe('SUCCESS');

      // Verify metadata in DB does NOT contain sensitive keys
      expect(JSON.stringify(dbOcr)).not.toContain('super-secret-token');

      fetchSpy.mockRestore();
    });
  });
});
