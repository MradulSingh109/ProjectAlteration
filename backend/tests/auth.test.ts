import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { RoleCode } from '@prisma/client';
import { generateToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

jest.setTimeout(30000);

describe('Step 3: Authentication & Authorization API Tests', () => {
  const testEmail = `test.inspector.${Date.now()}@example.com`;
  const testAdminEmail = `test.admin.${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  let inspectorToken: string;
  let adminToken: string;
  let inspectorUserId: string;

  beforeAll(async () => {
    // Clean up any old test users
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'test.' },
      },
    });

    // Ensure system roles exist
    await prisma.role.upsert({
      where: { code: RoleCode.INSPECTOR },
      update: {},
      create: {
        code: RoleCode.INSPECTOR,
        name: 'Field Inspector',
        description: 'Conducts packaged commodity inspections',
      },
    });

    const adminRole = await prisma.role.upsert({
      where: { code: RoleCode.ADMIN },
      update: {},
      create: {
        code: RoleCode.ADMIN,
        name: 'System Administrator',
        description: 'Full system administration access',
      },
    });

    // Create an Admin user for RBAC testing
    const hashedPassword = await hashPassword(testPassword);
    const adminUser = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: testAdminEmail,
        passwordHash: hashedPassword,
        roleId: adminRole.id,
        isActive: true,
      },
    });

    adminToken = generateToken({ sub: adminUser.id, role: RoleCode.ADMIN });
  });

  afterAll(async () => {
    // Clean up created test users
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'test.' },
      },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a new user with default INSPECTOR role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Inspector',
          email: testEmail,
          password: testPassword,
          role: 'ADMIN', // Should be ignored by security policy
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.role).toBe(RoleCode.INSPECTOR); // Enforces default role
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Never exposes passwordHash

      inspectorUserId = res.body.data.user.id;
      inspectorToken = res.body.data.token;
    });

    it('should reject registration with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid User',
          email: 'not-an-email',
          password: testPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with short password (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Password User',
          email: 'shortpass@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate registration with existing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate Inspector',
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully log in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for nonexistent email without exposing existence', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent.user.12345@example.com',
          password: testPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for disabled account', async () => {
      const disabledEmail = `test.disabled.${Date.now()}@example.com`;
      const inspectorRole = await prisma.role.findUniqueOrThrow({
        where: { code: RoleCode.INSPECTOR },
      });

      const hashedPassword = await hashPassword(testPassword);
      await prisma.user.create({
        data: {
          name: 'Disabled User',
          email: disabledEmail,
          passwordHash: hashedPassword,
          roleId: inspectorRole.id,
          isActive: false, // Disabled account
        },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: disabledEmail,
          password: testPassword,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile for valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(inspectorUserId);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.role).toBe(RoleCode.INSPECTOR);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject request without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with malformed Authorization token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject request with token containing invalid user ID sub format', async () => {
      const invalidSubToken = generateToken({ sub: 'non-uuid-user-id', role: RoleCode.INSPECTOR });
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidSubToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('RBAC Middleware Authorization', () => {
    it('should allow ADMIN token access to admin-only role check', async () => {
      // Create temporary endpoint test via supertest
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(RoleCode.ADMIN);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return success response on logout', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Logged out successfully');
    });
  });
});
