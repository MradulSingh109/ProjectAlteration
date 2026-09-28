import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { AuthService } from "@/application/auth/auth.service";
import { IAuthRepository } from "@/domain/auth/auth.repository.interface";
import { IPasswordService } from "@/infrastructure/auth/password.service";
import { IJwtService } from "@/infrastructure/auth/jwt.service";
import { Role } from "@/domain/auth/roles";
import { AppError } from "@/lib/errors";
import { UserEntity } from "@/domain/auth/user.entity";
import { SessionEntity } from "@/domain/auth/session.entity";

function createMockRepository(users: UserEntity[] = []): {
  repo: IAuthRepository;
  sessions: SessionEntity[];
} {
  const sessions: SessionEntity[] = [];
  const repo: IAuthRepository = {
    findUserByEmail: vi.fn(
      async (email: string) => users.find((u) => u.email === email) || null,
    ),
    findUserById: vi.fn(
      async (id: string) => users.find((u) => u.id === id) || null,
    ),
    createUser: vi.fn(),
    createSession: vi.fn(async (data) => {
      const s: SessionEntity = {
        id: "mock-session-uuid",
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash || null,
        isRevoked: false,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent || null,
        ipAddress: data.ipAddress || null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessions.push(s);
      return s;
    }),
    findSessionById: vi.fn(async (id: string) => {
      const s = sessions.find((x) => x.id === id);
      if (!s) return null;
      const u = users.find((x) => x.id === s.userId);
      if (!u) return null;
      return { ...s, user: u };
    }),
    findSessionByRefreshTokenHash: vi.fn(),
    revokeSession: vi.fn(async (id: string) => {
      const s = sessions.find((x) => x.id === id);
      if (s) s.isRevoked = true;
    }),
    revokeAllUserSessions: vi.fn(),
    touchSession: vi.fn(),
  };
  return { repo, sessions };
}

describe("User Authentication & Session Creation", () => {
  const testUser: UserEntity = {
    id: "user-123",
    email: "drilling.eng@nwis.gov.in",
    passwordHash: "correct_password_hash",
    role: Role.DRILLING_ENGINEER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("authenticates valid credentials and generates secure session with hashed refresh token", async () => {
    const { repo, sessions } = createMockRepository([testUser]);
    const pwService: IPasswordService = {
      hash: vi.fn(),
      compare: vi.fn(
        async (pw, hash) =>
          pw === "ValidPass123" && hash === "correct_password_hash",
      ),
    };
    const jwtService: IJwtService = {
      signAccessToken: vi.fn(
        async (payload) => `signed_jwt_for_${payload.sub}`,
      ),
      verifyAccessToken: vi.fn(),
    };

    const authService = new AuthService(repo, pwService, jwtService);

    const result = await authService.login(
      {
        email: "drilling.eng@nwis.gov.in",
        password: "ValidPass123",
      },
      { userAgent: "Mozilla/5.0", ipAddress: "127.0.0.1" },
    );

    expect(result.user.id).toBe("user-123");
    expect(result.user.email).toBe("drilling.eng@nwis.gov.in");
    expect(result.user.role).toBe(Role.DRILLING_ENGINEER);
    expect(result.accessToken).toBe("signed_jwt_for_user-123");
    expect(result.refreshToken).toBeDefined();

    // Verify refresh token hash in DB is SHA-256 and NOT the raw token
    expect(sessions.length).toBe(1);
    const createdSession = sessions[0];
    expect(createdSession.refreshTokenHash).not.toBe(result.refreshToken);

    const expectedHash = crypto
      .createHash("sha256")
      .update(result.refreshToken)
      .digest("hex");
    expect(createdSession.refreshTokenHash).toBe(expectedHash);
  });

  it("rejects incorrect password with generic INVALID_CREDENTIALS error (enumeration protection)", async () => {
    const { repo } = createMockRepository([testUser]);
    const pwService: IPasswordService = {
      hash: vi.fn(),
      compare: vi.fn(async () => false),
    };
    const jwtService: IJwtService = {
      signAccessToken: vi.fn(),
      verifyAccessToken: vi.fn(),
    };

    const authService = new AuthService(repo, pwService, jwtService);

    try {
      await authService.login({
        email: "drilling.eng@nwis.gov.in",
        password: "WrongPassword999",
      });
      expect.unreachable("Should have rejected incorrect password");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(401);
      expect(appErr.code).toBe("INVALID_CREDENTIALS");
      expect(appErr.message).toBe("Invalid email or password");
    }
  });

  it("rejects non-existent user with identical generic error and dummy compare execution (timing attack protection)", async () => {
    const { repo } = createMockRepository([]); // Empty repo
    const pwService: IPasswordService = {
      hash: vi.fn(),
      compare: vi.fn(async () => false),
    };
    const jwtService: IJwtService = {
      signAccessToken: vi.fn(),
      verifyAccessToken: vi.fn(),
    };

    const authService = new AuthService(repo, pwService, jwtService);

    try {
      await authService.login({
        email: "nonexistent@nwis.gov.in",
        password: "AnyPassword123",
      });
      expect.unreachable("Should have rejected nonexistent user");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(401);
      expect(appErr.code).toBe("INVALID_CREDENTIALS");
      expect(appErr.message).toBe("Invalid email or password");

      // Verify dummy comparison was executed to prevent timing leakage
      expect(pwService.compare).toHaveBeenCalled();
    }
  });
});
