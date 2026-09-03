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
- [ ] **Step 6 — OCR Integration**: OCR provider interface and integration
- [ ] **Step 7 — Declaration Extraction**: Extracting mandatory packaging attributes
- [ ] **Step 8 — Rule Engine**: Configurable, versioned Legal Metrology rule validation
- [ ] **Step 9 — Compliance Results**: Evidence scoring and PASS / FAIL / REVIEW outcomes
- [ ] **Step 10 — Human Review**: Manual override and audit trail history
- [ ] **Step 11 — Reports**: PDF compliance report generation
- [ ] **Step 12 — Dashboard & Analytics**: Summary metrics and statistics
- [ ] **Step 13 — Testing & Security**: Integration tests, rate limiting, security hardening
- [ ] **Step 14 — Deployment**: Docker containerization and deployment setup
