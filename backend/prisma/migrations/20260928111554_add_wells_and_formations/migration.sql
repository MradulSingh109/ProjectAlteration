-- CreateEnum
CREATE TYPE "WellStatus" AS ENUM ('PLANNED', 'DRILLING', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "wells" (
    "id" TEXT NOT NULL,
    "well_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "spud_date" TIMESTAMP(3),
    "planned_depth_md" DOUBLE PRECISION NOT NULL,
    "planned_depth_tvd" DOUBLE PRECISION NOT NULL,
    "status" "WellStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formations" (
    "id" TEXT NOT NULL,
    "well_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "top_md" DOUBLE PRECISION NOT NULL,
    "bottom_md" DOUBLE PRECISION NOT NULL,
    "lithology" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wells_well_id_key" ON "wells"("well_id");

-- CreateIndex
CREATE INDEX "wells_field_idx" ON "wells"("field");

-- CreateIndex
CREATE INDEX "wells_status_idx" ON "wells"("status");

-- CreateIndex
CREATE INDEX "wells_latitude_longitude_idx" ON "wells"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "formations_well_id_idx" ON "formations"("well_id");

-- CreateIndex
CREATE INDEX "formations_name_idx" ON "formations"("name");

-- AddForeignKey
ALTER TABLE "formations" ADD CONSTRAINT "formations_well_id_fkey" FOREIGN KEY ("well_id") REFERENCES "wells"("id") ON DELETE CASCADE ON UPDATE CASCADE;
