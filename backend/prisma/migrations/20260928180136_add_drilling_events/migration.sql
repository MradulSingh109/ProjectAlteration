-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MUD_LOSS', 'KICK', 'STUCK_PIPE', 'FISHING', 'TORQUE_SPIKE', 'PRESSURE_SPIKE', 'OVERPRESSURE', 'LOST_CIRCULATION', 'CEMENTING_FAILURE', 'CASING_PROBLEM', 'NPT', 'FORMATION_CHANGE', 'WELL_CONTROL');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'EDITED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "drilling_events" (
    "id" TEXT NOT NULL,
    "well_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "depth_md" DECIMAL(12,3) NOT NULL,
    "depth_tvd" DECIMAL(12,3),
    "formation" TEXT,
    "severity" "EventSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "cause" TEXT,
    "mitigation" TEXT,
    "outcome" TEXT,
    "source_document_id" TEXT NOT NULL,
    "source_page" INTEGER NOT NULL,
    "extraction_confidence" DECIMAL(4,3) NOT NULL,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drilling_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_drilling_events_well_id" ON "drilling_events"("well_id");

-- CreateIndex
CREATE INDEX "idx_drilling_events_type" ON "drilling_events"("event_type");

-- CreateIndex
CREATE INDEX "idx_drilling_events_review_status" ON "drilling_events"("review_status");

-- CreateIndex
CREATE INDEX "idx_drilling_events_severity" ON "drilling_events"("severity");

-- CreateIndex
CREATE INDEX "idx_drilling_events_source_doc" ON "drilling_events"("source_document_id");

-- CreateIndex
CREATE INDEX "idx_drilling_events_well_review" ON "drilling_events"("well_id", "review_status");

-- AddForeignKey
ALTER TABLE "drilling_events" ADD CONSTRAINT "drilling_events_well_id_fkey" FOREIGN KEY ("well_id") REFERENCES "wells"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drilling_events" ADD CONSTRAINT "drilling_events_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
