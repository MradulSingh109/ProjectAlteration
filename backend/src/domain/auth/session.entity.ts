import { UserEntity } from "./user.entity";

/**
 * Domain Session entity representing a persistent authentication session.
 * Decoupled from ORM / persistence models.
 */
export interface SessionEntity {
  id: string;
  userId: string;
  refreshTokenHash: string | null;
  isRevoked: boolean;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionWithUser extends SessionEntity {
  user: UserEntity;
}
