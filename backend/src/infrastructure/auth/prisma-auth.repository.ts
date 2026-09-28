import { prisma } from "@/infrastructure/database/prisma";
import { IAuthRepository } from "@/domain/auth/auth.repository.interface";
import { Role as DomainRole } from "@/domain/auth/roles";
import { User, Session, Role as PrismaRole } from "@prisma/client";

export class PrismaAuthRepository implements IAuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    role?: DomainRole;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: (data.role as PrismaRole) || PrismaRole.VIEWER,
      },
    });
  }

  async createSession(data: {
    userId: string;
    refreshTokenHash?: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<Session> {
    return prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findSessionById(
    sessionId: string,
  ): Promise<(Session & { user: User }) | null> {
    return prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  }

  async findSessionByRefreshTokenHash(
    tokenHash: string,
  ): Promise<(Session & { user: User }) | null> {
    return prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
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
}

export const authRepository = new PrismaAuthRepository();
