import crypto from 'crypto';

/**
 * Generates a unique inspection number in the format: INS-YYYYMMDD-XXXXXXXX
 * Example: INS-20260902-A8F42C91
 */
export const generateInspectionNumber = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `INS-${dateStr}-${randomHex}`;
};
