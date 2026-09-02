import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';

export const authenticateMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized(
        'Authentication required. Please provide a valid Bearer token.',
        'UNAUTHORIZED'
      );
    }

    const token = authHeader.split(' ')[1]?.trim();

    if (!token) {
      throw AppError.unauthorized(
        'Authentication required. Bearer token is missing.',
        'UNAUTHORIZED'
      );
    }

    // Verify JWT payload
    const decoded = verifyToken(token);

    // Fetch user from PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { role: true },
    });

    if (!user) {
      throw AppError.unauthorized(
        'User account associated with this token no longer exists.',
        'USER_NOT_FOUND'
      );
    }

    if (!user.isActive) {
      throw AppError.forbidden(
        'Account has been disabled. Access denied.',
        'ACCOUNT_DISABLED'
      );
    }

    // Attach safe user object to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.code,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
};
