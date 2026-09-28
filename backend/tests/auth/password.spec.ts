import { describe, it, expect } from "vitest";
import { passwordService } from "@/infrastructure/auth/password.service";
import { validatePassword } from "@/domain/auth/password-policy";

describe("Password Security & Hashing", () => {
  it("successfully hashes a plaintext password", async () => {
    const raw = "SecurePass123!";
    const hash = await passwordService.hash(raw);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(raw);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
  });

  it("verifies matching password correctly", async () => {
    const raw = "StrongP@ssw0rd";
    const hash = await passwordService.hash(raw);

    const isMatch = await passwordService.compare(raw, hash);
    expect(isMatch).toBe(true);
  });

  it("fails verification on incorrect password", async () => {
    const raw = "StrongP@ssw0rd";
    const hash = await passwordService.hash(raw);

    const isMatch = await passwordService.compare("WrongPassword123", hash);
    expect(isMatch).toBe(false);
  });

  it("enforces password complexity constraints", () => {
    // Too short (< 8 chars)
    const shortResult = validatePassword("Ab1!");
    expect(shortResult.isValid).toBe(false);
    expect(
      shortResult.errors.some((e) => e.includes("at least 8 characters")),
    ).toBe(true);

    // Missing uppercase
    const noUpperResult = validatePassword("password123");
    expect(noUpperResult.isValid).toBe(false);
    expect(noUpperResult.errors.some((e) => e.includes("uppercase"))).toBe(
      true,
    );

    // Missing lowercase
    const noLowerResult = validatePassword("PASSWORD123");
    expect(noLowerResult.isValid).toBe(false);
    expect(noLowerResult.errors.some((e) => e.includes("lowercase"))).toBe(
      true,
    );

    // Missing digit
    const noDigitResult = validatePassword("PasswordOnly");
    expect(noDigitResult.isValid).toBe(false);
    expect(noDigitResult.errors.some((e) => e.includes("numeric digit"))).toBe(
      true,
    );

    // Valid compliant password
    const validResult = validatePassword("ValidPass123");
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors.length).toBe(0);
  });
});
