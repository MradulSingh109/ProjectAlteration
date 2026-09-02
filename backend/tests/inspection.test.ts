import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { RoleCode, WorkflowStatus, ComplianceStatus } from '@prisma/client';
import { generateToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

jest.setTimeout(30000);

describe('Step 4: Inspection Management Module API Tests', () => {
  const ts = Date.now();
  const testPassword = 'StrongPassword123!';

  let inspector1Token: string;
  let inspector1UserId: string;
  let inspector2Token: string;
  let adminToken: string;
  let reviewerToken: string;

  let testCategoryId: string;
  let testProductId: string;
  let inspector1InspectionId: string;
  let inspector2InspectionId: string;

  beforeAll(async () => {
    // Clean up old test data in reverse foreign key order
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step4.' } } } });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step4.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP4' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP4' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step4.' } } });

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
        name: 'Inspector One',
        email: `test.step4.inspector1.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector1UserId = inspector1.id;
    inspector1Token = generateToken({ sub: inspector1.id, role: RoleCode.INSPECTOR });

    const inspector2 = await prisma.user.create({
      data: {
        name: 'Inspector Two',
        email: `test.step4.inspector2.${ts}@example.com`,
        passwordHash: hash,
        roleId: inspectorRole.id,
      },
    });
    inspector2Token = generateToken({ sub: inspector2.id, role: RoleCode.INSPECTOR });

    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: `test.step4.admin.${ts}@example.com`,
        passwordHash: hash,
        roleId: adminRole.id,
      },
    });
    adminToken = generateToken({ sub: admin.id, role: RoleCode.ADMIN });

    const reviewer = await prisma.user.create({
      data: {
        name: 'Reviewer User',
        email: `test.step4.reviewer.${ts}@example.com`,
        passwordHash: hash,
        roleId: reviewerRole.id,
      },
    });
    reviewerToken = generateToken({ sub: reviewer.id, role: RoleCode.REVIEWER });

    // 3. Create Test Category & Product
    const category = await prisma.productCategory.create({
      data: {
        code: `CAT-STEP4-${ts}`,
        name: 'Packaged Foods Step4',
        description: 'Test food items',
      },
    });
    testCategoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `Test Product Step4 ${ts}`,
        brandName: 'Brand Step4',
        manufacturerName: 'Mfg Step4 Pvt Ltd',
        categoryId: category.id,
      },
    });
    testProductId = product.id;
  });

  afterAll(async () => {
    // Clean up in reverse foreign key dependency order
    await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'test.step4.' } } } });
    await prisma.inspection.deleteMany({ where: { creator: { email: { contains: 'test.step4.' } } } });
    await prisma.product.deleteMany({ where: { category: { code: { contains: 'CAT-STEP4' } } } });
    await prisma.productCategory.deleteMany({ where: { code: { contains: 'CAT-STEP4' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.step4.' } } });
    await prisma.$disconnect();
  });

  describe('Product & Category APIs', () => {
    it('GET /api/product-categories - should return active categories', async () => {
      const res = await request(app)
        .get('/api/product-categories')
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.some((c: any) => c.id === testCategoryId)).toBe(true);
    });

    it('GET /api/products - should return list of products', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('POST /api/products - should create product with audit log', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({
          name: `New Product ${ts}`,
          brandName: 'New Brand',
          manufacturerName: 'New Mfg Ltd',
          categoryId: testCategoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.name).toBe(`New Product ${ts}`);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Product',
          entityId: res.body.data.product.id,
          action: 'PRODUCT_CREATED',
        },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('POST /api/inspections (Creation)', () => {
    it('should allow Inspector 1 to create an inspection with server-generated number and DRAFT status', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({
          productId: testProductId,
          remarks: 'Initial visual check notes',
          // Client malicious attempts
          inspectionNumber: 'CLIENT-HACKED-999',
          complianceStatus: 'PASS',
          createdBy: 'fake-uuid',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const insp = res.body.data.inspection;
      expect(insp.id).toBeDefined();
      expect(insp.inspectionNumber).not.toBe('CLIENT-HACKED-999');
      expect(insp.inspectionNumber).toMatch(/^INS-\d{8}-[A-F0-9]{8}$/);
      expect(insp.workflowStatus).toBe(WorkflowStatus.DRAFT);
      expect(insp.complianceStatus).toBe(ComplianceStatus.REVIEW);
      expect(insp.creator.id).toBe(inspector1UserId);
      expect(insp.product.id).toBe(testProductId);

      inspector1InspectionId = insp.id;

      // Verify audit log created
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Inspection',
          entityId: insp.id,
          action: 'INSPECTION_CREATED',
        },
      });
      expect(audit).toBeDefined();
    });

    it('should allow Admin to create an inspection', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          remarks: 'Admin test inspection',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should allow Inspector 2 to create an inspection', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${inspector2Token}`)
        .send({
          productId: testProductId,
          remarks: 'Inspector 2 test inspection',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      inspector2InspectionId = res.body.data.inspection.id;
    });

    it('should forbid Reviewer from creating an inspection', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          productId: testProductId,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .send({ productId: testProductId });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent product ID', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ productId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('GET /api/inspections/:id (Retrieval & Access Scoping)', () => {
    it('should allow Inspector 1 to retrieve own inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspector1InspectionId}`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection.id).toBe(inspector1InspectionId);
    });

    it('should FORBID Inspector 1 from retrieving Inspector 2 inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspector2InspectionId}`)
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow Admin to retrieve Inspector 2 inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspector2InspectionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection.id).toBe(inspector2InspectionId);
    });

    it('should allow Reviewer to retrieve Inspector 2 inspection', async () => {
      const res = await request(app)
        .get(`/api/inspections/${inspector2InspectionId}`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for unknown inspection ID', async () => {
      const res = await request(app)
        .get('/api/inspections/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });
  });

  describe('GET /api/inspections (Listing & Role Scoping)', () => {
    it('Inspector 1 list should strictly contain ONLY own inspections', async () => {
      const res = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data.items;
      expect(items.every((i: any) => i.creator.id === inspector1UserId)).toBe(true);
    });

    it('Admin list should contain inspections from multiple creators', async () => {
      const res = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    });

    it('Reviewer list should return paginated inspections', async () => {
      const res = await request(app)
        .get('/api/inspections?page=1&limit=10')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.page).toBe(1);
    });
  });

  describe('PATCH /api/inspections/:id (Updates)', () => {
    it('Inspector 1 can update remarks on own DRAFT inspection', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector1InspectionId}`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ remarks: 'Updated remarks by inspector 1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection.remarks).toBe('Updated remarks by inspector 1');

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Inspection',
          entityId: inspector1InspectionId,
          action: 'INSPECTION_UPDATED',
        },
      });
      expect(audit).toBeDefined();
    });

    it('Inspector 1 cannot update Inspector 2 inspection', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector2InspectionId}`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ remarks: 'Hacked remarks' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Reviewer cannot update inspection', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector1InspectionId}`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ remarks: 'Reviewer attempt' });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/inspections/:id/status (Workflow Transitions)', () => {
    it('Inspector 1 transitions DRAFT -> PROCESSING', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector1InspectionId}/status`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ status: WorkflowStatus.PROCESSING });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection.workflowStatus).toBe(WorkflowStatus.PROCESSING);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Inspection',
          entityId: inspector1InspectionId,
          action: 'INSPECTION_STATUS_CHANGED',
        },
      });
      expect(audit).toBeDefined();
    });

    it('Inspector 1 transitions PROCESSING -> UNDER_REVIEW', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector1InspectionId}/status`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ status: WorkflowStatus.UNDER_REVIEW });

      expect(res.status).toBe(200);
      expect(res.body.data.inspection.workflowStatus).toBe(WorkflowStatus.UNDER_REVIEW);
    });

    it('Inspector 1 transitions UNDER_REVIEW -> COMPLETED, setting completedAt timestamp', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector1InspectionId}/status`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ status: WorkflowStatus.COMPLETED });

      expect(res.status).toBe(200);
      expect(res.body.data.inspection.workflowStatus).toBe(WorkflowStatus.COMPLETED);
      expect(res.body.data.inspection.completedAt).not.toBeNull();
    });

    it('Rejects invalid status jump COMPLETED -> DRAFT', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector1InspectionId}/status`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ status: WorkflowStatus.DRAFT });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('Rejects updating remarks on a COMPLETED inspection', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${inspector1InspectionId}`)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ remarks: 'Post-completion edit attempt' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_WORKFLOW_STATE');
    });
  });
});
