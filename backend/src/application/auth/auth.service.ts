import crypto from "crypto";
import { IAuthRepository } from "@/domain/auth/auth.repository.interface";
import { authRepository as defaultAuthRepo } from "@/infrastructure/auth/prisma-auth.repository";
import {
  IPasswordService,
  passwordService as defaultPasswordService,
} from "@/infrastructure/auth/password.service";
import {
  IJwtService,
  jwtService as defaultJwtService,
} from "@/infrastructure/auth/jwt.service";
import { validatePassword } from "@/domain/auth/password-policy";
import { Role } from "@/domain/auth/roles";
import { SafeUser, toSafeUser } from "@/domain/auth/user.entity";
import { AppError } from "@/lib/errors";
import { config } from "@/config/env";
import {
  RegisterInput,
  RegisterSchema,
  LoginInput,
  LoginSchema,
  AuthResult,
} from "./auth.dto";

// Constant dummy hash to equalize timing when user does not exist
const DUMMY_HASH =
  "$2a$12$K89sP3dF3h7M9.b8s1y8.OhGk6kQ0rR6H6wDk6q4M6k8L2n1o0p9q";

export class AuthService {
  constructor(
    private readonly repo: IAuthRepository = defaultAuthRepo,
    private readonly passwordService: IPasswordService = defaultPasswordService,
    private readonly jwtService: IJwtService = defaultJwtService,
  ) {}

  /**
   * Registers a new user.
   *
   * Security constraints:
   * - Enforces password complexity policy
   * - Normalizes email (lowercase & trimmed)
   * - Checks email uniqueness (returns 409 conflict)
   * - Hashes password with bcrypt (cost factor 12)
   * - Server-side enforces default role VIEWER (prevents privilege escalation)
   * - Never returns password hash
   */
  async register(input: RegisterInput): Promise<SafeUser> {
    const validated = RegisterSchema.parse(input);

    const passwordCheck = validatePassword(validated.password);
    if (!passwordCheck.isValid) {
      throw AppError.validation(passwordCheck.errors[0], passwordCheck.errors);
    }

    const existingUser = await this.repo.findUserByEmail(validated.email);
    if (existingUser) {
      throw AppError.conflict(
        "An account with this email address already exists",
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const passwordHash = await this.passwordService.hash(validated.password);

    // Initial self-registration is strictly restricted to VIEWER
    const user = await this.repo.createUser({
      email: validated.email,
      passwordHash,
      role: Role.VIEWER,
    });

    return toSafeUser(user);
  }

  /**
   * Authenticates user credentials and establishes a persistent session.
   *
   * Security constraints:
   * - Timing attack mitigation via constant-time dummy hash comparison for non-existent users
   * - Standardized generic error on invalid email or password (prevents enumeration)
   * - Generates cryptographically strong random refresh token
   * - Only stores SHA-256 hash of refresh token in database (compromised DB protection)
   * - Issues short-lived access JWT
   */
  async login(
    input: LoginInput,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const validated = LoginSchema.parse(input);

    const user = await this.repo.findUserByEmail(validated.email);

    if (!user || !user.isActive) {
      // Execute dummy comparison to mitigate timing side-channel attacks
      await this.passwordService.compare(validated.password, DUMMY_HASH);
      throw AppError.invalidCredentials();
    }

    const isValidPassword = await this.passwordService.compare(
      validated.password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      throw AppError.invalidCredentials();
    }

    // Generate secure random refresh token
    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + config.jwt.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    );

    const session = await this.repo.createSession({
      userId: user.id,
      refreshTokenHash,
      expiresAt,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    });

    const accessToken = await this.jwtService.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      sessionId: session.id,
    });

    return {
      user: toSafeUser(user),
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt,
    };
  }

  /**
   * Revokes a session upon user logout.
   */
  async logout(sessionId?: string): Promise<void> {
    if (!sessionId) return;
    try {
      await this.repo.revokeSession(sessionId);
    } catch {
      // Ignore if session already deleted or revoked
    }
  }

  /**
   * Validates an active session and checks revocation and active user status.
   */
  async validateSession(sessionId: string): Promise<SafeUser> {
    const session = await this.repo.findSessionById(sessionId);

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw AppError.unauthorized(
        "Session is invalid or expired",
        "SESSION_EXPIRED",
      );
    }

    if (!session.user || !session.user.isActive) {
      throw AppError.unauthorized(
        "User account is inactive or disabled",
        "UNAUTHORIZED",
      );
    }

    return toSafeUser(session.user);
  }

  /**
   * Retrieves current safe user by user ID.
   */
  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.repo.findUserById(userId);

    if (!user || !user.isActive) {
      throw AppError.unauthorized("User not found or inactive", "UNAUTHORIZED");
    }

    return toSafeUser(user);
  }
}

export const authService = new AuthService();
