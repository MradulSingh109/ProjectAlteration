-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rule_versions" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "severity" "EventSeverity" NOT NULL,
    "conditions" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "well_id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "telemetry_reading_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" "EventSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggered_at" TIMESTAMP(3) NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "resolution_notes" TEXT,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_rules_rule_code_key" ON "alert_rules"("rule_code");

-- CreateIndex
CREATE INDEX "idx_alert_rule_version_active" ON "alert_rule_versions"("rule_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alert_rule_version" ON "alert_rule_versions"("rule_id", "version");

-- CreateIndex
CREATE INDEX "idx_alerts_well_status" ON "alerts"("well_id", "status");

-- CreateIndex
CREATE INDEX "idx_alerts_well_triggered" ON "alerts"("well_id", "triggered_at");

-- CreateIndex
CREATE INDEX "idx_alerts_status" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "idx_alerts_severity" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "idx_alerts_rule_version" ON "alerts"("rule_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alert_reading_rule_version" ON "alerts"("telemetry_reading_id", "rule_version_id");

-- AddForeignKey
ALTER TABLE "alert_rule_versions" ADD CONSTRAINT "alert_rule_versions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_well_id_fkey" FOREIGN KEY ("well_id") REFERENCES "wells"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "alert_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_telemetry_reading_id_fkey" FOREIGN KEY ("telemetry_reading_id") REFERENCES "telemetry_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
