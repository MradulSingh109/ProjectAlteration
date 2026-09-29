import { prisma } from "@/infrastructure/database/prisma";
import { IAuthRepository } from "@/domain/auth/auth.repository.interface";
import { Role as DomainRole } from "@/domain/auth/roles";
import { UserEntity } from "@/domain/auth/user.entity";
import { SessionEntity, SessionWithUser } from "@/domain/auth/session.entity";

export class PrismaAuthRepository implements IAuthRepository {
  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return (user as UserEntity) || null;
  }

  async findUserById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return (user as UserEntity) || null;
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    role?: DomainRole;
  }): Promise<UserEntity> {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || DomainRole.VIEWER,
      },
    });
    return user as UserEntity;
  }

  async createSession(data: {
    userId: string;
    refreshTokenHash?: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<SessionEntity> {
    const session = await prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
    return session as SessionEntity;
  }

  async findSessionById(sessionId: string): Promise<SessionWithUser | null> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    return (session as unknown as SessionWithUser) || null;
  }

  async findSessionByRefreshTokenHash(
    tokenHash: string,
  ): Promise<SessionWithUser | null> {
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    return (session as unknown as SessionWithUser) || null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async touchSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  async updateSessionRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
    newExpiresAt: Date,
  ): Promise<SessionEntity> {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
        lastUsedAt: new Date(),
      },
    });
    return session as SessionEntity;
  }
}

export const authRepository = new PrismaAuthRepository();
