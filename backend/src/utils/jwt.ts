import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { RoleCode } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from './AppError';

export interface JwtPayload {
  sub: string;
  role: RoleCode;
}

export const generateToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.JWT_SECRET as Secret, options);
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as Secret) as JwtPayload;
    
    if (!decoded.sub || !decoded.role) {
      throw AppError.unauthorized('Invalid token payload', 'INVALID_TOKEN');
    }
    
    return {
      sub: decoded.sub,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Authentication token has expired', 'TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Invalid authentication token', 'INVALID_TOKEN');
  }
};
