import { PrismaClient } from "@prisma/client";

/**
 * Global singleton pattern for Prisma Client in Next.js.
 * Prevents connection multiplication across hot module reloads in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check helper executing a minimal connectivity probe.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
}> {
  const start = Date.now();
  try {
    // Executes a minimal SELECT 1 probe against the database engine
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      connected: false,
    };
  }
}
