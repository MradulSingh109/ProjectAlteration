-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "well_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs_resource_id" ON "audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_well_id" ON "audit_logs"("well_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");

-- Enforce extraction confidence range between 0.000 and 1.000 at database level
ALTER TABLE "drilling_events"
  ADD CONSTRAINT "chk_drilling_events_extraction_confidence"
  CHECK ("extraction_confidence" >= 0.000 AND "extraction_confidence" <= 1.000);
