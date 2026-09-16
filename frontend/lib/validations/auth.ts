import { z } from "zod";

/**
 * Client-side validation schema for user login.
 * Strictly aligned with backend loginSchema requirements.
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase(),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
