import { describe, it, expect, vi } from "vitest";
import { AuthService } from "@/application/auth/auth.service";
import { IAuthRepository } from "@/domain/auth/auth.repository.interface";
import { IPasswordService } from "@/infrastructure/auth/password.service";
import { IJwtService } from "@/infrastructure/auth/jwt.service";
import { Role } from "@/domain/auth/roles";
import { AppError } from "@/lib/errors";
import { UserEntity } from "@/domain/auth/user.entity";

function createMockRepository(
  existingUsers: UserEntity[] = [],
): IAuthRepository {
  const users = [...existingUsers];
  return {
    findUserByEmail: vi.fn(
      async (email: string) => users.find((u) => u.email === email) || null,
    ),
    findUserById: vi.fn(
      async (id: string) => users.find((u) => u.id === id) || null,
    ),
    createUser: vi.fn(
      async (data: { email: string; passwordHash: string; role?: Role }) => {
        const newUser: UserEntity = {
          id: "mock-user-uuid",
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role || Role.VIEWER,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(newUser);
        return newUser;
      },
    ),
    createSession: vi.fn(),
    findSessionById: vi.fn(),
    findSessionByRefreshTokenHash: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllUserSessions: vi.fn(),
    touchSession: vi.fn(),
    updateSessionRefreshToken: vi.fn(),
  };
}

function createMockPasswordService(): IPasswordService {
  return {
    hash: vi.fn(async (pw: string) => `hashed_${pw}`),
    compare: vi.fn(async (pw: string, hash: string) => hash === `hashed_${pw}`),
  };
}

function createMockJwtService(): IJwtService {
  return {
    signAccessToken: vi.fn(async () => "mock.jwt.token"),
    verifyAccessToken: vi.fn(),
  };
}

describe("User Registration & Privilege Escalation Prevention", () => {
  it("registers a new user with valid credentials successfully", async () => {
    const repo = createMockRepository();
    const pwService = createMockPasswordService();
    const jwtService = createMockJwtService();
    const authService = new AuthService(repo, pwService, jwtService);

    const safeUser = await authService.register({
      email: "engineer@nwis.gov.in",
      password: "StrongPassword123",
    });

    expect(safeUser).toBeDefined();
    expect(safeUser.email).toBe("engineer@nwis.gov.in");
    expect(safeUser.role).toBe(Role.VIEWER);
    expect(safeUser.isActive).toBe(true);

    // Password must NEVER be returned or leaked
    expect((safeUser as any).password).toBeUndefined();
    expect((safeUser as any).passwordHash).toBeUndefined();

    // Verify plaintext password was never stored directly
    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "engineer@nwis.gov.in",
        passwordHash: "hashed_StrongPassword123",
        role: Role.VIEWER,
      }),
    );
  });

  it("rejects invalid email formats", async () => {
    const repo = createMockRepository();
    const authService = new AuthService(
      repo,
      createMockPasswordService(),
      createMockJwtService(),
    );

    await expect(
      authService.register({
        email: "not-an-email",
        password: "StrongPassword123",
      }),
    ).rejects.toThrow();
  });

  it("rejects weak passwords violating complexity policy", async () => {
    const repo = createMockRepository();
    const authService = new AuthService(
      repo,
      createMockPasswordService(),
      createMockJwtService(),
    );

    // Fails schema length validation (< 8 chars)
    await expect(
      authService.register({
        email: "test@nwis.gov.in",
        password: "weak",
      }),
    ).rejects.toThrow();

    // Fails password complexity policy (8+ chars but no uppercase or digits)
    await expect(
      authService.register({
        email: "test2@nwis.gov.in",
        password: "lowercaseonlypass",
      }),
    ).rejects.toThrowError(AppError);
  });

  it("rejects duplicate email registrations with EMAIL_ALREADY_EXISTS conflict", async () => {
    const existingUser: UserEntity = {
      id: "existing-uuid",
      email: "existing@nwis.gov.in",
      passwordHash: "hashed_Existing123",
      role: Role.VIEWER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const repo = createMockRepository([existingUser]);
    const authService = new AuthService(
      repo,
      createMockPasswordService(),
      createMockJwtService(),
    );

    try {
      await authService.register({
        email: "existing@nwis.gov.in",
        password: "StrongPassword123",
      });
      expect.unreachable("Should have thrown conflict error");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe("EMAIL_ALREADY_EXISTS");
    }
  });

  it("prevents privilege escalation when client attempts to inject ADMIN role", async () => {
    const repo = createMockRepository();
    const authService = new AuthService(
      repo,
      createMockPasswordService(),
      createMockJwtService(),
    );

    // Client passes role in request body attempt
    const maliciousPayload = {
      email: "hacker@nwis.gov.in",
      password: "StrongPassword123",
      role: "ADMIN",
    };

    const safeUser = await authService.register(maliciousPayload as any);

    // Initial self-registration MUST be constrained to VIEWER
    expect(safeUser.role).toBe(Role.VIEWER);
    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Role.VIEWER,
      }),
    );
  });
});
