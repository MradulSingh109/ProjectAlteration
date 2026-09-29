import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export interface IPasswordService {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordService implements IPasswordService {
  /**
   * Hashes a plaintext password using bcrypt with 12 salt rounds.
   * Plaintext passwords and hashes are never logged.
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compares a plaintext password against a stored bcrypt hash.
   * Constant-time comparison handled internally by bcrypt.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const passwordService = new BcryptPasswordService();
