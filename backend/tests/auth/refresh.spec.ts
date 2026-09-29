import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { AuthService } from "@/application/auth/auth.service";
import { IAuthRepository } from "@/domain/auth/auth.repository.interface";
import { IJwtService } from "@/infrastructure/auth/jwt.service";
import { Role } from "@/domain/auth/roles";
import { UserEntity } from "@/domain/auth/user.entity";
import { SessionEntity, SessionWithUser } from "@/domain/auth/session.entity";
import { AppError } from "@/lib/errors";

function createMockRepository(initialSessions: SessionWithUser[] = []): {
  repo: IAuthRepository;
  sessions: SessionWithUser[];
} {
  const sessions = [...initialSessions];

  const repo: IAuthRepository = {
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createUser: vi.fn(),
    createSession: vi.fn(),
    findSessionById: vi.fn(
      async (id: string) => sessions.find((s) => s.id === id) || null,
    ),
    findSessionByRefreshTokenHash: vi.fn(async (hash: string) => {
      return sessions.find((s) => s.refreshTokenHash === hash) || null;
    }),
    updateSessionRefreshToken: vi.fn(
      async (sessionId: string, newHash: string, newExpiresAt: Date) => {
        const s = sessions.find((x) => x.id === sessionId);
        if (!s) throw new Error("Session not found");
        s.refreshTokenHash = newHash;
        s.expiresAt = newExpiresAt;
        s.lastUsedAt = new Date();
        return s;
      },
    ),
    revokeSession: vi.fn(async (id: string) => {
      const s = sessions.find((x) => x.id === id);
      if (s) s.isRevoked = true;
    }),
    revokeAllUserSessions: vi.fn(),
    touchSession: vi.fn(),
  };

  return { repo, sessions };
}

describe("Refresh Token Flow & Rotation Lifecycle", () => {
  const activeUser: UserEntity = {
    id: "user-uuid-1",
    email: "geologist@nwis.gov.in",
    passwordHash: "some_hash",
    role: Role.GEOLOGIST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const initialRawToken = "initial_valid_refresh_token_123456";
  const initialTokenHash = crypto
    .createHash("sha256")
    .update(initialRawToken)
    .digest("hex");

  it("successfully refreshes session, rotates refresh token, and invalidates old token", async () => {
    const validSession: SessionWithUser = {
      id: "session-uuid-1",
      userId: activeUser.id,
      refreshTokenHash: initialTokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
      userAgent: "TestAgent",
      ipAddress: "127.0.0.1",
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: activeUser,
    };

    const { repo, sessions } = createMockRepository([validSession]);
    const jwtService: IJwtService = {
      signAccessToken: vi.fn(async (payload) => `new_jwt_for_${payload.sub}`),
      verifyAccessToken: vi.fn(),
    };

    const authService = new AuthService(repo, {} as any, jwtService);

    // 1. Execute refresh with initial token
    const result = await authService.refreshToken(initialRawToken);

    expect(result.user.email).toBe("geologist@nwis.gov.in");
    expect(result.accessToken).toBe("new_jwt_for_user-uuid-1");
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(initialRawToken);

    // 2. Verify session in DB was updated with new hash (Rotation)
    const currentSession = sessions[0];
    const newExpectedHash = crypto
      .createHash("sha256")
      .update(result.refreshToken)
      .digest("hex");
    expect(currentSession.refreshTokenHash).toBe(newExpectedHash);

    // 3. Attempting to REUSE the old token must fail immediately (Replay Protection)
    await expect(
      authService.refreshToken(initialRawToken),
    ).rejects.toThrowError(AppError);
  });

  it("rejects invalid refresh tokens with 401 SESSION_EXPIRED", async () => {
    const { repo } = createMockRepository([]);
    const authService = new AuthService(repo);

    try {
      await authService.refreshToken("completely_bogus_token");
      expect.unreachable("Should have rejected invalid token");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(401);
      expect(appErr.code).toBe("SESSION_EXPIRED");
    }
  });

  it("rejects expired sessions with 401 SESSION_EXPIRED", async () => {
    const expiredSession: SessionWithUser = {
      id: "session-uuid-expired",
      userId: activeUser.id,
      refreshTokenHash: initialTokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() - 10000), // In past
      userAgent: null,
      ipAddress: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: activeUser,
    };

    const { repo } = createMockRepository([expiredSession]);
    const authService = new AuthService(repo);

    try {
      await authService.refreshToken(initialRawToken);
      expect.unreachable("Should have rejected expired session");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(401);
      expect(appErr.code).toBe("SESSION_EXPIRED");
      expect(appErr.message).toContain("expired");
    }
  });

  it("rejects revoked sessions with 401 SESSION_EXPIRED", async () => {
    const revokedSession: SessionWithUser = {
      id: "session-uuid-revoked",
      userId: activeUser.id,
      refreshTokenHash: initialTokenHash,
      isRevoked: true, // Revoked
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: null,
      ipAddress: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: activeUser,
    };

    const { repo } = createMockRepository([revokedSession]);
    const authService = new AuthService(repo);

    try {
      await authService.refreshToken(initialRawToken);
      expect.unreachable("Should have rejected revoked session");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(401);
      expect(appErr.code).toBe("SESSION_EXPIRED");
      expect(appErr.message).toContain("revoked");
    }
  });

  it("rejects refresh requests when associated user is inactive", async () => {
    const inactiveUser: UserEntity = {
      ...activeUser,
      id: "inactive-user-id",
      isActive: false, // Disabled account
    };

    const session: SessionWithUser = {
      id: "session-uuid-inactive-user",
      userId: inactiveUser.id,
      refreshTokenHash: initialTokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: null,
      ipAddress: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: inactiveUser,
    };

    const { repo } = createMockRepository([session]);
    const authService = new AuthService(repo);

    try {
      await authService.refreshToken(initialRawToken);
      expect.unreachable("Should have rejected inactive user");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(401);
      expect(appErr.code).toBe("UNAUTHORIZED");
      expect(appErr.message).toContain("inactive or disabled");
    }
  });
});
