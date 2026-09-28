import { SignJWT, jwtVerify } from "jose";
import { config } from "@/config/env";
import { AccessTokenPayload } from "@/domain/auth/tokens";
import { AppError } from "@/lib/errors";

export interface IJwtService {
  signAccessToken(
    payload: Omit<AccessTokenPayload, "iat" | "exp">,
  ): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}

export class JoseJwtService implements IJwtService {
  private getSecretKey(): Uint8Array {
    return new TextEncoder().encode(config.jwt.secret);
  }

  /**
   * Signs a short-lived access JWT containing minimal identity claims.
   */
  async signAccessToken(
    payload: Omit<AccessTokenPayload, "iat" | "exp">,
  ): Promise<string> {
    const secretKey = this.getSecretKey();
    return new SignJWT({
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    })
      .setSubject(payload.sub)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(config.jwt.expiresIn)
      .sign(secretKey);
  }

  /**
   * Cryptographically verifies access JWT and returns payload.
   * Throws safe, typed AppError on expired or tampered tokens.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const secretKey = this.getSecretKey();
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });

      return {
        sub: payload.sub as string,
        email: payload.email as string,
        role: payload.role as AccessTokenPayload["role"],
        sessionId: payload.sessionId as string,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (err: unknown) {
      const errorObj = err as { code?: string };
      if (errorObj?.code === "ERR_JWT_EXPIRED") {
        throw AppError.unauthorized(
          "Authentication token has expired",
          "SESSION_EXPIRED",
        );
      }
      throw AppError.unauthorized(
        "Invalid authentication token",
        "INVALID_TOKEN",
      );
    }
  }
}

export const jwtService = new JoseJwtService();
