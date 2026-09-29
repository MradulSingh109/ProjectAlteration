-- AlterTable
ALTER TABLE "drilling_events" ADD COLUMN "npt_hours" DECIMAL(6,2),
ADD COLUMN "source_section" TEXT,
ADD COLUMN "extraction_model" TEXT,
ADD COLUMN "evidence" JSONB,
ADD COLUMN "ml_event_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_drilling_events_ml_event_id" ON "drilling_events"("ml_event_id");
