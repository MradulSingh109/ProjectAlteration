import { z } from "zod";
import { SafeUser } from "@/domain/auth/user.entity";

/**
 * Zod validation schema for user registration.
 *
 * Security: Role escalation is prevented at the schema boundary.
 * Clients cannot specify a role during registration.
 */
export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Zod validation schema for user authentication / login.
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
