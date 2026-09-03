import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { RoleCode, WorkflowStatus } from '@prisma/client';
import { generateToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

jest.setTimeout(30000);

// Minimal valid JPEG binary buffer (with valid FF D8 FF header)
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9,
]);

// Minimal valid PNG binary buffer (with valid 89 50 4E 47 0D 0A 1A 0A header)
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

// Invalid spoofed text buffer
const INVALID_SPOOFED_BUFFER = Buffer.from('This is plain text pretending to be an image file');

describe('Step 5: Image Upload & Storage Module API Tests', () => {
  const ts = Date.now();
  const testPassword = 'StrongPassword123!';

  let inspector1Token: string;
  let adminToken: string;
  let reviewerToken: string;

  let inspection1Id: string;
  let inspection2Id: string;
  let completedInspectionId: string;
  let cancelledInspectionId: string;

  let uploadedImage1Id: string;

  beforeAll(async () => {
    // Clean up in reverse foreign key order
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step5.' } } } });
    await prisma.inspectionImage.deleteMany({ where: { inspection: { creator: { email: { contains: 'test.step5.' } } } } });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step5.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP5' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP5' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step5.' } } });

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
        name: 'Step5 Inspector 1',
        email: `test.step5.inspector1.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector1Token = generateToken({ sub: inspector1.id, role: RoleCode.INSPECTOR });

    const inspector2 = await prisma.user.create({
      data: {
        name: 'Step5 Inspector 2',
        email: `test.step5.inspector2.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'Step5 Admin',
        email: `test.step5.admin.${ts}@example.com`,
        passwordHash: hash,
        roleId: adminRole.id,
      },
    });
    adminToken = generateToken({ sub: admin.id, role: RoleCode.ADMIN });

    const reviewer = await prisma.user.create({
      data: {
        name: 'Step5 Reviewer',
        email: `test.step5.reviewer.${ts}@example.com`,
        passwordHash: hash,
        roleId: reviewerRole.id,
      },
    });
    reviewerToken = generateToken({ sub: reviewer.id, role: RoleCode.REVIEWER });

    // 3. Category & Product
    const category = await prisma.productCategory.create({
      data: {
        code: `CAT-STEP5-${ts}`,
        name: 'Step5 Packaged Product Category',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Step5 Test Product ${ts}`,
        brandName: 'Brand Step5',
        manufacturerName: 'Mfg Step5 Ltd',
        categoryId: category.id,
      },
    });

    // 4. Inspections
    const insp1 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP5-1-${ts}`,
        productId: product.id,
        createdBy: inspector1.id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspection1Id = insp1.id;

    const insp2 = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP5-2-${ts}`,
        productId: product.id,
        createdBy: inspector2.id,
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });
    inspection2Id = insp2.id;

    const completedInsp = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP5-COMP-${ts}`,
        productId: product.id,
        createdBy: inspector1.id,
        workflowStatus: WorkflowStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    completedInspectionId = completedInsp.id;

    const cancelledInsp = await prisma.inspection.create({
      data: {
        inspectionNumber: `INS-STEP5-CANCEL-${ts}`,
        productId: product.id,
        createdBy: inspector1.id,
        workflowStatus: WorkflowStatus.CANCELLED,
      },
    });
    cancelledInspectionId = cancelledInsp.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step5.' } } } });
    await prisma.inspectionImage.deleteMany({ where: { inspection: { creator: { email: { contains: 'test.step5.' } } } } });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step5.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP5' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP5' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step5.' } } });
    await prisma.$disconnect();
  });

  describe('Authentication & Access Controls', () => {
    it('POST /api/inspections/:id/images - should reject unauthenticated request', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images`)
        .attach('file', VALID_JPEG_BUFFER, 'test-front.jpg');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/inspections/:id/images - should reject unauthenticated request', async () => {
      const res = await request(app).get(`/api/inspections/${inspection1Id}/images`);
      expect(res.status).toBe(401);
    });

    it('DELETE /api/inspections/:id/images/:imageId - should reject unauthenticated request', async () => {
      const res = await request(app).delete(
        `/api/inspections/${inspection1Id}/images/00000000-0000-0000-0000-000000000000`
      );
      expect(res.status).toBe(401);
    });
  });

  describe('Validation & File Upload Filters', () => {
    it('should reject request missing file attachment', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .field('imageType', 'FRONT');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE');
    });

    it('should reject file with spoofed MIME / invalid binary magic bytes signature', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .attach('file', INVALID_SPOOFED_BUFFER, {
          filename: 'fake-image.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('should reject upload to non-existent inspection ID', async () => {
      const res = await request(app)
        .post('/api/inspections/00000000-0000-0000-0000-000000000000/images')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_JPEG_BUFFER, 'valid.jpg');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });
  });

  describe('Workflow Status Restrictions', () => {
    it('should reject image upload to a COMPLETED inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${completedInspectionId}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .attach('file', VALID_JPEG_BUFFER, 'front.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSPECTION_NOT_EDITABLE');
    });

    it('should reject image upload to a CANCELLED inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${cancelledInspectionId}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .attach('file', VALID_JPEG_BUFFER, 'front.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSPECTION_NOT_EDITABLE');
    });
  });

  describe('RBAC & Ownership Scoping', () => {
    it('should forbid Reviewer from uploading images', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .attach('file', VALID_JPEG_BUFFER, 'front.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should FORBID Inspector 1 from uploading image to Inspector 2 inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .attach('file', VALID_JPEG_BUFFER, 'front.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Successful Upload, Listing, Retrieval & Deletion Flow', () => {
    it('should allow Inspector 1 to upload valid JPEG image to own inspection', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection1Id}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .field('imageType', 'FRONT')
        .attach('file', VALID_JPEG_BUFFER, 'product-front.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const img = res.body.data.image;
      expect(img.id).toBeDefined();
      expect(img.inspectionId).toBe(inspection1Id);
      expect(img.imageType).toBe('FRONT');
      expect(img.mimeType).toBe('image/jpeg');
      expect(img.originalFileName).toBe('product-front.jpg');
      expect(img.storageKey).toMatch(/^inspections\//);

      uploadedImage1Id = img.id;

      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'InspectionImage',
          entityId: img.id,
          action: 'INSPECTION_IMAGE_UPLOADED',
        },
      });
      expect(audit).toBeDefined();
    });

    it('should allow Admin to upload valid PNG image to Inspection 2', async () => {
      const res = await request(app)
        .post(`/api/inspections/${inspection2Id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('imageType', 'BACK')
        .attach('file', VALID_PNG_BUFFER, 'product-back.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.image.imageType).toBe('BACK');
      expect(res.body.data.image.mimeType).toBe('image/png');
    });

    it('should allow Inspector 1 to list images of own inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1Id}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.images)).toBe(true);
      expect(res.body.data.images.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow Reviewer to list images of Inspection 1', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1Id}/images`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should FORBID Inspector 1 from listing images of Inspector 2 inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection2Id}/images`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
    });

    it('should allow Inspector 1 to get single image by ID', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection1Id}/images/${uploadedImage1Id}`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.image.id).toBe(uploadedImage1Id);
    });

    it('IDOR Check: should reject cross-inspection image access (image from Inspection 1 requested under Inspection 2)', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspection2Id}/images/${uploadedImage1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('IMAGE_NOT_FOUND');
    });

    it('should FORBID Reviewer from deleting image', async () => {
      const res = await request(app)
        .delete(`/api/inspections/${inspection1Id}/images/${uploadedImage1Id}`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow Inspector 1 to delete own uploaded image', async () => {
      const res = await request(app)
        .delete(`/api/inspections/${inspection1Id}/images/${uploadedImage1Id}`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      // Verify DB deletion
      const dbImg = await prisma.inspectionImage.findUnique({
        where: { id: uploadedImage1Id },
      });
      expect(dbImg).toBeNull();

      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'InspectionImage',
          entityId: uploadedImage1Id,
          action: 'INSPECTION_IMAGE_DELETED',
        },
      });
      expect(audit).toBeDefined();
    });
  });
});
