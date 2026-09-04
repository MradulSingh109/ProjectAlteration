# SIH26034 Backend

## Project Description

The **SIH26034 Backend** is a legal compliance inspection engine for packaged commodities under the **Legal Metrology (Packaged Commodities) Rules, 2011**. 

The system enables inspectors and users to upload photographs of packaged products, extract mandatory declarations (MRP, net quantity, manufacturer details, dates, consumer care, etc.) using OCR and Computer Vision/AI, and validate those declarations against a versioned, rule-based legal engine. The backend preserves complete audit trails and evidence including bounding boxes, OCR text, confidence scores, violations, human review actions, and compliance status.

---

## Architecture Diagram

```text
                                +---------------------------+
                                |      Frontend App         |
                                +-------------+-------------+
                                              |
                                              v
                                +-------------+-------------+
                                |     API Gateway / Router  |
                                |       (/api/prefix)       |
                                +-------------+-------------+
                                              |
                                              v
                                +-------------+-------------+
                                |        Controllers        |
                                +-------------+-------------+
                                              |
                                              v
                                +-------------+-------------+
                                |         Services          |
                                +----+----+----+-------+----+
                                     |    |    |       |
      +------------------------------+    |    |       +-----------------------------+
      |                                   |    |                                     |
      v                                   v    v                                     v
+-----+------+                   +--------+----+----+                          +-----+-----+
|  PostgreSQL|                   |   OCR/AI Engine   |                          | Supabase  |
| (via Prisma)                   | (PaddleOCR/Vision)|                          |  Storage  |
+------------+                   +------------------+                          +-----------+
```

---

## Inspection Lifecycle State Machine

```text
               +-------------------------------------------+
               |                  DRAFT                    |
               +---------------------+---------------------+
                                     |
                         (Start processing)
                                     v
               +---------------------+---------------------+
               |               PROCESSING                  |
               +---------------------+---------------------+
                                     |
                         (Submit for review)
                                     v
               +---------------------+---------------------+
               |              UNDER_REVIEW                 |
               +---------------------+---------------------+
                                     |
                         (Finalize inspection)
                                     v
               +---------------------+---------------------+
               |               COMPLETED                   |
               +-------------------------------------------+
```
*Note: Any inspection in `DRAFT` or `PROCESSING` state can also transition to `CANCELLED` (terminal state).*

---

## Technology Stack

### Current (Step 1 Foundation, Step 2 Database, Step 3 Auth, Step 4 Inspection Management, Step 5 Image Upload & Storage)
* **Runtime**: Node.js
* **Language**: TypeScript
* **Web Framework**: Express.js
* **Database & ORM**: PostgreSQL & Prisma ORM (`@prisma/client` locked to `6.19.3`)
* **Security & Auth**: JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), RBAC (`ADMIN`, `INSPECTOR`, `REVIEWER`)
* **File Upload & Storage**: Multer memory-storage (`multer`), Supabase Storage SDK (`@supabase/supabase-js`), Magic bytes file signature verification
* **Validation**: Zod
* **Logging**: Pino & pino-pretty
* **Security Foundation**: Helmet, CORS
* **Environment Configuration**: dotenv with Zod validation
* **Execution/Build**: tsx (development runner), tsc (production build)
* **Testing**: Jest (`ts-jest`), Supertest (100% automated test coverage across 57 tests)

---

## API Endpoints Overview

### 1. Authentication (`/api/auth`)
* `POST /api/auth/register` — Public registration (strictly assigns `INSPECTOR` role).
* `POST /api/auth/login` — User login (returns JWT token and user profile).
* `GET /api/auth/me` — Get current user profile (Authenticated).
* `POST /api/auth/logout` — Logout user token session (Authenticated).

### 2. Products & Categories (`/api`)
* `GET /api/product-categories` — List active product categories (`ADMIN`, `INSPECTOR`, `REVIEWER`).
* `GET /api/products` — Paginated list of active products with category information (`ADMIN`, `INSPECTOR`, `REVIEWER`).
* `GET /api/products/:id` — View details of a specific active product (`ADMIN`, `INSPECTOR`, `REVIEWER`).
* `POST /api/products` — Create a new product with audit logging (`ADMIN`, `INSPECTOR`).

### 3. Inspection Management (`/api/inspections`)
* `POST /api/inspections` — Create new inspection in `DRAFT` state (`ADMIN`, `INSPECTOR`).
  * Generates unique inspection number: `INS-YYYYMMDD-XXXXXXXX`.
  * Initial `workflowStatus` = `DRAFT`, `complianceStatus` = `REVIEW`.
* `GET /api/inspections` — Paginated & filterable list of inspections.
  * Role Scoping: `INSPECTOR` can only view their own created inspections. `ADMIN` and `REVIEWER` can view all.
* `GET /api/inspections/:id` — View details of a single inspection.
  * Role Scoping: `INSPECTOR` can only view their own inspection (returns `403` otherwise).
* `PATCH /api/inspections/:id` — Update inspection remarks (`ADMIN`, `INSPECTOR`).
  * Editable only in `DRAFT` or `PROCESSING` state.
* `PATCH /api/inspections/:id/status` — Transition workflow status (`ADMIN`, `INSPECTOR`).
  * Validates state machine rules and sets `completedAt` timestamp upon completion.

### 4. Image Upload & Storage (`/api/inspections/:id/images`)
* `POST /api/inspections/:id/images` — Upload product package image (`ADMIN`, `INSPECTOR`).
  * Validates binary signature (magic bytes) for JPEG, PNG, and WebP formats.
  * Stores object in Supabase Storage (`inspections/{inspectionId}/{uuid}.{ext}`) and metadata in PostgreSQL.
  * Rejected if inspection is in `COMPLETED` or `CANCELLED` state.
* `GET /api/inspections/:id/images` — List all images attached to an inspection (`ADMIN`, `INSPECTOR` own, `REVIEWER`).
* `GET /api/inspections/:id/images/:imageId` — Retrieve metadata and accessible URL for a single image with IDOR cross-inspection verification (`ADMIN`, `INSPECTOR` own, `REVIEWER`).
* `DELETE /api/inspections/:id/images/:imageId` — Delete image record and remove object from storage (`ADMIN`, `INSPECTOR` own).

### 5. OCR Integration Infrastructure (`/api/inspections/:id/images/:imageId/ocr`)
* `POST /api/inspections/:id/images/:imageId/ocr` — Trigger OCR processing for a specific package image (`ADMIN`, `INSPECTOR` own).
  * Executes OCR pipeline via configured provider (`MockOcrProvider` or `HttpOcrProvider`).
  * Enforces state machine workflow rules (only `DRAFT` or `PROCESSING` allowed).
  * Prevents duplicate concurrent requests via pending database lock.
  * Records `OCRResult` database record with processing status (`PENDING` -> `SUCCESS` or `FAILED`).
* `GET /api/inspections/:id/images/:imageId/ocr` — Retrieve all historical OCR results for an image (`ADMIN`, `INSPECTOR` own, `REVIEWER`).
* `GET /api/inspections/:id/images/:imageId/ocr/status` — Get current OCR processing status (`NOT_STARTED`, `PENDING`, `SUCCESS`, `FAILED`).
* `POST /api/inspections/:id/images/:imageId/ocr/reprocess` — Trigger a new OCR run on an existing image while preserving historical provenance records (`ADMIN`, `INSPECTOR` own).

---

## Role-Based Access Control (RBAC) Matrix

| Endpoint | Method | ADMIN | INSPECTOR | REVIEWER |
| :--- | :---: | :---: | :---: | :---: |
| `/api/auth/register` | POST | Public | Public | Public |
| `/api/auth/login` | POST | Public | Public | Public |
| `/api/auth/me` | GET | Yes | Yes | Yes |
| `/api/product-categories` | GET | Yes | Yes | Yes |
| `/api/products` | GET | Yes | Yes | Yes |
| `/api/products/:id` | GET | Yes | Yes | Yes |
| `/api/products` | POST | Yes | Yes | No |
| `/api/inspections` | POST | Yes | Yes | No |
| `/api/inspections` | GET | All | Own Only | All |
| `/api/inspections/:id` | GET | All | Own Only | All |
| `/api/inspections/:id` | PATCH | Yes | Own Only | No |
| `/api/inspections/:id/status` | PATCH | Yes | Own Only | No |
| `/api/inspections/:id/images` | POST | Yes | Own Only | No |
| `/api/inspections/:id/images` | GET | All | Own Only | All |
| `/api/inspections/:id/images/:imageId` | GET | All | Own Only | All |
| `/api/inspections/:id/images/:imageId` | DELETE | Yes | Own Only | No |
| `/api/inspections/:id/images/:imageId/ocr` | POST | Yes | Own Only | No |
| `/api/inspections/:id/images/:imageId/ocr` | GET | All | Own Only | All |
| `/api/inspections/:id/images/:imageId/ocr/status` | GET | All | Own Only | All |
| `/api/inspections/:id/images/:imageId/ocr/reprocess` | POST | Yes | Own Only | No |

---

## OCR Architecture & Provider Abstraction

```text
Node.js Backend
   |
   v
OcrService (Factory & Lifecycle Manager)
   |
   +----------------------+----------------------+
   |                                             |
   v                                             v
MockOcrProvider                               HttpOcrProvider
(Development & Local Testing)                 (Production AI/ML Microservice)
   |                                             |
   +----------------------+----------------------+
                          |
                          v
                    OcrOutput
                          |
                          v
                 OCRResult (PostgreSQL)
```

### Future AI/ML OCR Service HTTP Contract

The backend `HttpOcrProvider` communicates with the AI/ML OCR microservice using the following HTTP request/response contract:

#### Request format sent by backend:
```http
POST /ocr
Content-Type: application/json
Authorization: Bearer <OCR_SERVICE_API_KEY>

{
  "imageUrl": "https://supabase-storage-url/inspections/uuid/file.jpg",
  "inspectionId": "4c4246bb-5645-4fd1-a185-5b5eb0ea21fa",
  "inspectionImageId": "e229e192-3004-4b53-bc2e-2e407519a42f",
  "mimeType": "image/jpeg"
}
```

#### Expected response returned by AI/ML service:
```json
{
  "success": true,
  "data": {
    "rawText": "MRP ₹499.00 (Incl. of all taxes)\nNet Quantity: 500 g\nMfg Date: 06/2026",
    "confidence": 0.95,
    "language": "eng",
    "provider": "paddleocr-v4",
    "processingTimeMs": 620,
    "boundingBoxes": [
      { "text": "MRP ₹499.00", "confidence": 0.98, "x": 10, "y": 20, "width": 100, "height": 30 },
      { "text": "Net Quantity: 500 g", "confidence": 0.94, "x": 10, "y": 60, "width": 120, "height": 30 }
    ],
    "metadata": {
      "model": "paddleocr-v4",
      "device": "gpu"
    }
  }
}
```

---

## Step 6B — OCR Result Processing & Normalization

The backend does **not** perform OCR inference. OCR inference is provided by an independent AI/ML microservice through the `IOcrProvider` abstraction.

### Processing & Normalization Pipeline Architecture

```text
AI/ML OCR / MockProvider
   |
   v
OcrOutput
   |
   v
OcrNormalizationService & Zod Validation (ocrResultValidationSchema)
   |
   +---> Raw Text: Preserved exactly without spell-correction or attribute parsing
   +---> Confidence: Standardized scale (0..100 -> 0..1, null handled cleanly)
   +---> Bounding Boxes: Geometry validated (x, y, width, height >= 0)
   +---> Metadata: Sanitized (sensitive auth keys/tokens stripped)
   |
   v
OCRResult (PostgreSQL Provenance Record)
```

### Key Normalization Rules & Guarantees

1. **Text Provenance**: `rawText` is preserved as an immutable evidence record. Attribute extraction (MRP, dates, net quantity, manufacturer) is deferred strictly to **Step 7**.
2. **Confidence Scaling**: Standardized to a `0..1` floating point scale. Any provider output on a `0..100` scale is automatically converted (`val / 100`).
3. **Bounding Box Geometry**: Validates non-negative coordinates (`x >= 0, y >= 0, width >= 0, height >= 0`). Rejects malformed bounding box inputs with code `OCR_INVALID_BOUNDING_BOXES` (502 Bad Gateway) and sets database status to `FAILED`.
4. **Historical Provenance Preservation**: Every OCR run or reprocessing attempt creates a new `OCRResult` record in PostgreSQL without overwriting or deleting historical OCR records.
5. **Zero Prisma Schema Alterations**: Reuses the existing PostgreSQL schema and `OCRResult` model without requiring migrations.

---

## Step 7 — OCR Attribute Extraction & Declaration Processing

Step 7 parses normalized OCR text into structured Legal Metrology package commodity declarations (`Declaration` records) without running rule compliance evaluations (which belong to Step 8).

### Extraction Pipeline Architecture

```text
OCRResult (rawText)
   |
   v
DeclarationParser (Deterministic Extractor Engine)
   |
   +---> MRP (e.g. ₹499.00, Rs. 250) -> normalized JSON { value: 499, currency: "INR" }
   +---> NET_QUANTITY (e.g. 500 g, 1 L) -> normalized JSON { value: 500, unit: "g" }
   +---> MFG_DATE (e.g. Mfg Date 06/2026) -> normalized JSON { dateText: "06/2026" }
   +---> EXP_DATE (e.g. Exp Date 06/2028) -> normalized JSON { dateText: "06/2028" }
   +---> CONSUMER_CARE (e.g. Helpline / Email / Phone)
   +---> COUNTRY_OF_ORIGIN (e.g. Made in / Country of Origin)
   +---> COMMODITY_NAME (e.g. Commodity Name / Product Name)
   +---> MFG_ADDRESS (e.g. Manufactured by / Packed by)
   +---> IMPORTER_DETAILS (e.g. Imported by / Importer)
   |
   v
Prisma $transaction
   |
   +---> Idempotency: Replaces previous unreviewed automated declarations for this image
   +---> Declaration Records: Persisted in PostgreSQL linked to inspectionId & sourceImageId
   +---> Audit Trail: Logs DECLARATION_EXTRACTION_COMPLETED event
```

### Key Declaration API Endpoints

| Method | Endpoint | Description | Roles Allowed |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/inspections/:id/images/:imageId/ocr/:ocrResultId/extract` | Trigger declaration extraction | `ADMIN`, `INSPECTOR` (own) |
| `POST` | `/api/inspections/:id/images/:imageId/ocr/:ocrResultId/reextract` | Re-trigger declaration extraction idempotently | `ADMIN`, `INSPECTOR` (own) |
| `GET` | `/api/inspections/:id/declarations` | Retrieve all extracted declarations for inspection | `ADMIN`, `INSPECTOR` (own), `REVIEWER` |
| `GET` | `/api/inspections/:id/declarations/:declarationId` | Retrieve single declaration by ID | `ADMIN`, `INSPECTOR` (own), `REVIEWER` |

### Key Extraction Guarantees & Constraints

1. **Non-Hallucination Guardrail**: The parser never invents or hallucinates missing attributes. Absent attributes remain `null`.
2. **Provenance Traceability**: Declarations maintain foreign key linkages to both `inspectionId` and `sourceImageId`.
3. **Idempotency & Re-extraction**: Re-triggering extraction replaces previous automated `OCR` declarations derived from the same source image without multiplying duplicate records.
4. **Workflow State Restrictions**: Extraction is allowed only for inspections in `DRAFT` or `PROCESSING` state. Inspections in `COMPLETED` or `CANCELLED` state return `INSPECTION_NOT_EDITABLE` (400).
5. **Zero Prisma Schema Alterations**: Uses existing `Declaration`, `DeclarationType`, `DeclarationSource`, and `Evidence` Prisma models without database migrations.

---

## Getting Started & Setup

### Prerequisites
* **Node.js**: v18.x or higher
* **npm**: v9.x or higher
* **PostgreSQL**: v14.x or higher

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Ensure `.env` is configured properly with your PostgreSQL connection string, JWT secret & Supabase Storage credentials:
   ```env
   NODE_ENV=development
   PORT=5000
   API_PREFIX=/api
   LOG_LEVEL=info
   CORS_ORIGIN=*
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sih26034_db?schema=public"
   JWT_SECRET="your-super-secret-key-32-chars-minimum"
   JWT_EXPIRES_IN="7d"
   SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   SUPABASE_STORAGE_BUCKET="inspection-images"
   MAX_FILE_SIZE_MB=10

   # OCR Provider Configuration
   OCR_PROVIDER=mock
   OCR_SERVICE_URL=https://ai-ocr-service.internal/ocr
   OCR_SERVICE_API_KEY=your-ocr-service-api-key
   OCR_TIMEOUT_MS=30000
   ```

4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

---

## Development & Testing

### Development Server
Runs the TypeScript server with auto-reload:
```bash
npm run dev
```

### Run Integration Tests
Runs the full suite of automated Jest integration tests:
```bash
npm test
```

### Build for Production
Compiles TypeScript into JavaScript inside the `dist/` directory:
```bash
npm run build
```

---

## Development Roadmap

- [x] **Step 1 — Foundation & Architecture**: Express, TypeScript, Zod env, Pino logging, Helmet, CORS, Error handling, Health check
- [x] **Step 2 — Database**: PostgreSQL & Prisma schema, ER diagram, versioned rule engine, seed data
- [x] **Step 3 — Authentication**: User roles, JWT, bcrypt password hashing, RBAC middleware (`ADMIN`, `INSPECTOR`, `REVIEWER`)
- [x] **Step 4 — Inspection Management**: Server-generated inspection numbers (`INS-YYYYMMDD-XXXXXXXX`), state machine workflow, ownership scoping, product lookups, audit logging
- [x] **Step 5 — Image Upload & Storage**: Multi-part upload, Supabase Storage abstraction, magic bytes validation, IDOR protection, workflow status checks, audit logging
- [x] **Step 6A — Backend OCR Integration Layer**: Provider abstraction (`MockOcrProvider`, `HttpOcrProvider`), `OCRResult` database lifecycle, Zod external response validation, `AbortController` timeouts, audit logging, 100% test coverage across 78 tests
- [x] **Step 6B — OCR Result Processing, Normalization & Persistence**: `OcrNormalizationService`, Zod schema validation (`ocrResultValidationSchema`), confidence normalization (0..100 -> 0..1), bounding box geometry checks, metadata sanitization, error codes (`OCR_INVALID_OUTPUT`, `OCR_INVALID_TEXT`, `OCR_INVALID_CONFIDENCE`, `OCR_INVALID_BOUNDING_BOXES`), zero Prisma schema modifications, full historical provenance, 82/82 tests passing
- [x] **Step 7 — OCR Attribute Extraction & Declaration Processing**: `DeclarationExtractionService`, deterministic `DeclarationParser` engine (`MRP`, `NET_QUANTITY`, `MFG_DATE`, `EXP_DATE`, `CONSUMER_CARE`, `COUNTRY_OF_ORIGIN`, `COMMODITY_NAME`, `MFG_ADDRESS`, `IMPORTER_DETAILS`), evidence/image provenance linking, idempotency on re-extraction, RBAC enforcement, zero database schema changes/migrations, 95/95 tests passing
- [ ] **Step 8 — Rule Engine**: Configurable, versioned Legal Metrology rule validation
- [ ] **Step 9 — Compliance Results**: Evidence scoring and PASS / FAIL / REVIEW outcomes
- [ ] **Step 10 — Human Review**: Manual override and audit trail history
- [ ] **Step 11 — Reports**: PDF compliance report generation
- [ ] **Step 12 — Dashboard & Analytics**: Summary metrics and statistics
- [ ] **Step 13 — Testing & Security**: Integration tests, rate limiting, security hardening
- [ ] **Step 14 — Deployment**: Docker containerization and deployment setup

