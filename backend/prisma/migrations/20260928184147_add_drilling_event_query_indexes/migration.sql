-- CreateIndex
CREATE INDEX "idx_drilling_events_well_depth" ON "drilling_events"("well_id", "depth_md");

-- CreateIndex
CREATE INDEX "idx_drilling_events_doc_created" ON "drilling_events"("source_document_id", "created_at");
