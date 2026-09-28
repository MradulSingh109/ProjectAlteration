import { User, Session } from "@prisma/client";
import { Role } from "./roles";

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(data: {
    email: string;
    passwordHash: string;
    role?: Role;
  }): Promise<User>;
  createSession(data: {
    userId: string;
    refreshTokenHash?: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<Session>;
  findSessionById(
    sessionId: string,
  ): Promise<(Session & { user: User }) | null>;
  findSessionByRefreshTokenHash(
    tokenHash: string,
  ): Promise<(Session & { user: User }) | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  touchSession(sessionId: string): Promise<void>;
}
