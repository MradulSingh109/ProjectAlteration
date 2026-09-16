import { describe, it, expect } from "vitest";
import { loginSchema } from "@/lib/validations/auth";

describe("Login Validation Schema", () => {
  it("validates correct email and password", () => {
    const input = {
      email: "inspector@example.com",
      password: "StrongPassword123!",
    };
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("inspector@example.com");
      expect(result.data.password).toBe("StrongPassword123!");
    }
  });

  it("trims and lowercases email address", () => {
    const input = {
      email: "  INSPECTOR.TEST@Example.COM  ",
      password: "somepassword",
    };
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("inspector.test@example.com");
    }
  });

  it("fails when email is invalid format", () => {
    const input = {
      email: "not-an-email",
      password: "validpassword",
    };
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find(
        (issue) => issue.path[0] === "email"
      );
      expect(emailIssue?.message).toMatch(/valid email/i);
    }
  });

  it("fails when email is empty", () => {
    const input = {
      email: "",
      password: "validpassword",
    };
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("fails when password is empty", () => {
    const input = {
      email: "user@example.com",
      password: "",
    };
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordIssue = result.error.issues.find(
        (issue) => issue.path[0] === "password"
      );
      expect(passwordIssue?.message).toMatch(/Password is required/i);
    }
  });
});
