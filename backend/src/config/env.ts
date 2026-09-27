/**
 * Application environment configuration foundation.
 * Reads runtime variables with sensible development defaults.
 */

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  apiPrefix: "/api/v1",
  app: {
    name: "nwis-backend",
    version: "0.1.0",
  },
} as const;
