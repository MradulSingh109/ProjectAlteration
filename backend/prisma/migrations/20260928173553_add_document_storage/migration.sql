-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('WCR', 'DDR', 'MUD_LOG', 'CEMENTING_REPORT', 'WELL_SURVEY');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "well_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_hash" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestion_status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_documents_well_id" ON "documents"("well_id");

-- CreateIndex
CREATE INDEX "idx_documents_type" ON "documents"("document_type");

-- CreateIndex
CREATE INDEX "idx_documents_ingestion_status" ON "documents"("ingestion_status");

-- CreateIndex
CREATE INDEX "idx_documents_file_hash" ON "documents"("file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "uq_well_document_file_hash" ON "documents"("well_id", "file_hash");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_well_id_fkey" FOREIGN KEY ("well_id") REFERENCES "wells"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
