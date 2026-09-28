import { z } from "zod";

/**
 * Centrally validated environment schema for NWIS Backend.
 * Enforces production-grade secret requirements and sensible defaults for local development.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long")
    .optional(),
  JWT_EXPIRES_IN: z.string().default("1h"),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().default(7),
  AUTH_COOKIE_NAME: z.string().default("nwis_access_token"),
  REFRESH_COOKIE_NAME: z.string().default("nwis_refresh_token"),
  TRUSTED_ORIGINS: z.string().optional(),
});

const isProd = process.env.NODE_ENV === "production";
const parsed = envSchema.safeParse(process.env);

if (!parsed.success && isProd) {
  // Fail fast in production without logging raw variable contents
  throw new Error(
    "Invalid environment configuration. Missing or invalid required environment variables.",
  );
}

const jwtSecret =
  process.env.JWT_SECRET ||
  (isProd
    ? (() => {
        throw new Error(
          "JWT_SECRET must be configured with at least 32 characters in production.",
        );
      })()
    : "development_jwt_secret_min_32_characters_long_for_dev_test");

export const config = {
  env: (process.env.NODE_ENV || "development") as
    "development" | "production" | "test",
  port: parseInt(process.env.PORT || "3000", 10),
  apiPrefix: "/api/v1",
  app: {
    name: "nwis-backend",
    version: "0.1.0",
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    refreshTokenExpiresInDays: parseInt(
      process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || "7",
      10,
    ),
  },
  cookies: {
    accessTokenName: process.env.AUTH_COOKIE_NAME || "nwis_access_token",
    refreshTokenName: process.env.REFRESH_COOKIE_NAME || "nwis_refresh_token",
  },
  security: {
    trustedOrigins: (process.env.TRUSTED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },
} as const;
