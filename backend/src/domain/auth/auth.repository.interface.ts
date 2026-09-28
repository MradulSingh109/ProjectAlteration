import { Role } from "./roles";
import { UserEntity } from "./user.entity";
import { SessionEntity, SessionWithUser } from "./session.entity";

/**
 * Domain repository contract for authentication and session persistence.
 * Completely decoupled from specific ORM/database technologies (Clean Architecture).
 */
export interface IAuthRepository {
  findUserByEmail(email: string): Promise<UserEntity | null>;
  findUserById(id: string): Promise<UserEntity | null>;
  createUser(data: {
    email: string;
    passwordHash: string;
    role?: Role;
  }): Promise<UserEntity>;
  createSession(data: {
    userId: string;
    refreshTokenHash?: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<SessionEntity>;
  findSessionById(sessionId: string): Promise<SessionWithUser | null>;
  findSessionByRefreshTokenHash(
    tokenHash: string,
  ): Promise<SessionWithUser | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  touchSession(sessionId: string): Promise<void>;
  updateSessionRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
    newExpiresAt: Date,
  ): Promise<SessionEntity>;
}
