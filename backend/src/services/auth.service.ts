import { RoleCode } from '@prisma/client';
import { prisma } from '../config/database';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';

export interface SanitizedUser {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: SanitizedUser;
  token: string;
}

export class AuthService {
  private static sanitizeUser(user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }, roleCode: RoleCode): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roleCode,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static async register(input: RegisterInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw AppError.conflict(
        'An account with this email already exists',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // Default role assignment is strictly INSPECTOR
    const inspectorRole = await prisma.role.findUnique({
      where: { code: RoleCode.INSPECTOR },
    });

    if (!inspectorRole) {
      throw AppError.internal(
        'System role initialization failure: INSPECTOR role not found',
        'ROLE_NOT_FOUND'
      );
    }

    // Hash password securely
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
        roleId: inspectorRole.id,
        isActive: true,
      },
    });

    // Generate JWT access token
    const token = generateToken({
      sub: user.id,
      role: inspectorRole.code,
    });

    return {
      user: this.sanitizeUser(user, inspectorRole.code),
      token,
    };
  }

  static async login(input: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Find user with role
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true },
    });

    // Generic error to prevent user enumeration
    if (!user) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check account status
    if (!user.isActive) {
      throw AppError.forbidden('Account is disabled. Please contact system administrator.', 'ACCOUNT_DISABLED');
    }

    // Verify bcrypt password
    const isPasswordValid = await comparePassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Generate JWT token
    const token = generateToken({
      sub: user.id,
      role: user.role.code,
    });

    return {
      user: this.sanitizeUser(user, user.role.code),
      token,
    };
  }

  static async getCurrentUser(userId: string): Promise<SanitizedUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Account is disabled. Please contact system administrator.', 'ACCOUNT_DISABLED');
    }

    return this.sanitizeUser(user, user.role.code);
  }
}
