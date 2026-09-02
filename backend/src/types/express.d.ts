import { RoleCode } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
