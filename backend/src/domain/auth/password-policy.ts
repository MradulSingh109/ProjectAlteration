export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export const PASSWORD_CONSTRAINTS = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
} as const;

/**
 * Validates password strength without unnecessarily restrictive rules.
 * Requires:
 * - At least 8 characters, maximum 128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < PASSWORD_CONSTRAINTS.MIN_LENGTH) {
    errors.push(
      `Password must be at least ${PASSWORD_CONSTRAINTS.MIN_LENGTH} characters long`,
    );
  }
  if (password && password.length > PASSWORD_CONSTRAINTS.MAX_LENGTH) {
    errors.push(
      `Password must not exceed ${PASSWORD_CONSTRAINTS.MAX_LENGTH} characters`,
    );
  }
  if (PASSWORD_CONSTRAINTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password || "")) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (PASSWORD_CONSTRAINTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password || "")) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (PASSWORD_CONSTRAINTS.REQUIRE_NUMBER && !/[0-9]/.test(password || "")) {
    errors.push("Password must contain at least one numeric digit");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
