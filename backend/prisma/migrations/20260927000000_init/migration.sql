-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "database_health_checks" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_health_checks_pkey" PRIMARY KEY ("id")
);
