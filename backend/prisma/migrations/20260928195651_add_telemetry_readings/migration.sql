-- CreateTable
CREATE TABLE "telemetry_readings" (
    "id" TEXT NOT NULL,
    "well_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "sequence_number" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "depth_md" DECIMAL(12,3) NOT NULL,
    "depth_tvd" DECIMAL(12,3),
    "rate_of_penetration" DECIMAL(8,3),
    "hook_load" DECIMAL(10,2),
    "standpipe_pressure" DECIMAL(10,2),
    "annular_pressure" DECIMAL(10,2),
    "surface_torque" DECIMAL(10,2),
    "rotary_rpm" DECIMAL(8,2),
    "flow_rate_in" DECIMAL(10,2),
    "flow_rate_out" DECIMAL(10,2),
    "mud_density" DECIMAL(6,2),
    "metadata" JSONB,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_telemetry_well_timestamp" ON "telemetry_readings"("well_id", "timestamp");

-- CreateIndex
CREATE INDEX "idx_telemetry_timestamp" ON "telemetry_readings"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uq_telemetry_well_source_seq" ON "telemetry_readings"("well_id", "source_id", "sequence_number");

-- AddForeignKey
ALTER TABLE "telemetry_readings" ADD CONSTRAINT "telemetry_readings_well_id_fkey" FOREIGN KEY ("well_id") REFERENCES "wells"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
