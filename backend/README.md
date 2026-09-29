# Nearby Wells Intelligence System (NWIS) — Standalone Backend

> **Smart India Hackathon 2026 — Problem Statement 121 (NWIS)**  
> Production-grade, headless, standalone backend engineered for drilling intelligence, offset-well similarity analytics, historical technical document provenance, time-series telemetry ingestion, and deterministic rule-based alert evaluation.

---

## 1. Project Purpose

The **Nearby Wells Intelligence System (NWIS)** is designed to assist petroleum engineers, drilling engineers, and geologists during well planning and drilling operations. By indexing historical offset wells, formation tops, past drilling events (kicks, mud loss, stuck pipe, overpressure), technical document archives (WCR, DDR, Mud Logs), and real-time sensor streams, NWIS provides:

1. **Spatial Proximity & Offset Intelligence**: Deterministic discovery and ranking of nearby wells using geodetic distance, formation stratigraphy overlap, depth interval matching, and historical incident frequency.
2. **Technical Document Storage & Provenance**: Cryptographically validated, sanitized PDF ingestion with metadata tracking and audit logging.
3. **Drilling Event Management & Review Workflow**: Operational event indexing with provenance tracking to source documents/pages, confidence boundaries, and human review lifecycle (`PENDING_REVIEW -> APPROVED | EDITED | INVALIDATED`).
4. **Time-Series Telemetry Ingestion**: High-throughput machine-authenticated drilling parameter ingestion with database-enforced idempotency and out-of-order tolerance.
5. **Deterministic Alert Engine**: Real-time evaluation of single-reading anomalies and sustained multi-reading conditions (e.g. mud flow discrepancies) with immutable rule versioning, lifecycle state machine (`ACTIVE -> ACKNOWLEDGED -> RESOLVED`), and auditable evidence snapshots.

---

## 2. Architecture

The backend follows **Clean / Hexagonal Architecture** principles, strictly decoupling domain rules, application orchestration, infrastructure adapters, and the HTTP presentation layer:

```text
HTTP / REST API (src/app/api/v1/)
       │
       ▼
Application Layer (src/application/)
  ├── Auth Guards & RBAC
  ├── Application Services (Well, Document, Event, Telemetry, Alert, Audit)
  └── Data Transfer Objects (DTOs) & Zod Validation Schemas
       │
       ▼
Domain Layer (src/domain/)
  ├── Entities & Value Objects (Pure TypeScript)
  ├── Repository Interfaces (Ports)
  └── Domain Services (DeterministicRuleEvaluator)
       │
       ▼
Infrastructure Layer (src/infrastructure/)
  ├── Database (Prisma ORM & PostgreSQL on Neon)
  ├── Storage (Local filesystem abstraction with safe key resolution)
  ├── Security (Jose JWT, Bcrypt password hashing, CSRF guard)
  └── Audit (Durable database audit trail logger)
```

---

## 3. Technology Stack

- **Runtime & Framework:** Node.js (v20+), Next.js 16.3 (App Router, Turbopack)
- **Language:** TypeScript 5 (Strict Mode, `noImplicitAny: true`, `strictNullChecks: true`)
- **Database & ORM:** PostgreSQL (Serverless Neon Database), Prisma ORM 6.19
- **Validation:** Zod 4.6 (Strict schema parsing for requests, queries, and environment)
- **Cryptography & Security:** `jose` (JWT sign & verify), `bcryptjs` (Salt rounds = 12), Node.js native `crypto`
- **Testing:** Vitest 5.0 (Unit, integration, and domain state-machine suites)
- **Code Quality:** ESLint 9 (Flat config), Prettier 3.5

---

## 4. Directory Structure

```text
backend/
├── prisma/
│   ├── migrations/            # 10 sequential forward migrations
│   └── schema.prisma          # Database schema models, enums, and indexes
├── src/
│   ├── app/
│   │   └── api/v1/            # 29 REST API route endpoints
│   │       ├── alerts/        # Alert detail, acknowledge, resolve routes
│   │       ├── auth/          # Login, logout, register, refresh, me routes
│   │       ├── documents/     # Document stream, metadata, document-events routes
│   │       ├── events/        # Event detail, review routes
│   │       ├── health/        # Liveness & database connectivity routes
│   │       ├── telemetry/     # Machine telemetry ingestion & evaluation routes
│   │       └── wells/         # Wells, formations, offsets, well-documents, well-alerts
│   ├── application/           # Application services, DTOs, Zod validators, guards
│   ├── config/                # Validated environment configuration (env.ts)
│   ├── domain/                # Entities, repository interfaces, domain evaluators
│   ├── infrastructure/        # Prisma repositories, storage adapters, security helpers
│   └── lib/                   # Standardized errors (AppError) and API responses
├── tests/                     # 30 Vitest test suites (298 passing unit/integration tests)
├── .env.example               # Environment template with documented requirements
├── next.config.ts             # Security headers and server configuration
└── verify-correction.mjs      # Neon database runtime integration test suite (38 checks)
```

---

## 5. Environment Variables

All variables are centrally validated at startup using Zod in `src/config/env.ts`:

| Variable                        | Type                                | Default              | Description                                       |
| ------------------------------- | ----------------------------------- | -------------------- | ------------------------------------------------- |
| `NODE_ENV`                      | `development \| production \| test` | `development`        | Runtime environment mode                          |
| `PORT`                          | `number`                            | `3000`               | Port for local HTTP server                        |
| `DATABASE_URL`                  | `string`                            | _(Required)_         | PostgreSQL connection string (Neon pooled/direct) |
| `DATABASE_URL_UNPOOLED`         | `string`                            | _(Optional)_         | Direct connection string for Prisma migrations    |
| `JWT_SECRET`                    | `string (min 32 chars)`             | _(Dev default)_      | Cryptographic HMAC secret for signing JWTs        |
| `JWT_EXPIRES_IN`                | `string`                            | `1h`                 | Access token lifetime duration                    |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `number`                            | `7`                  | Refresh token lifespan (days)                     |
| `AUTH_COOKIE_NAME`              | `string`                            | `nwis_access_token`  | Name of HTTP-only access token cookie             |
| `REFRESH_COOKIE_NAME`           | `string`                            | `nwis_refresh_token` | Name of HTTP-only refresh token cookie            |
| `TRUSTED_ORIGINS`               | `string` (comma-separated)          | `""`                 | Authorized frontend origins for CSRF/CORS         |
| `DOCUMENT_STORAGE_PATH`         | `string`                            | `storage/documents`  | Local root directory for technical PDF files      |
| `MAX_DOCUMENT_SIZE_MB`          | `number`                            | `25`                 | Maximum allowed document size (MB)                |
| `TELEMETRY_API_KEY`             | `string (min 16 chars)`             | _(Dev default)_      | Machine-to-backend API key for rig telemetry      |

---

## 6. Database Setup

1. Provision a PostgreSQL 15+ database or Neon project.
2. Configure `.env` in the `backend/` directory:
   ```bash
   DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/nwis_db?sslmode=require"
   ```
3. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

---

## 7. Prisma Migrations

Database schema evolution is managed via 10 forward migrations:

1. `20260927000000_init`: Initial database health check model.
2. `20260928102529_add_auth_and_session_models`: Users and sessions with role enum.
3. `20260928111554_add_wells_and_formations`: Core well master and formation stratigraphy.
4. `20260928120000_change_well_depths_to_decimal`: Millimeter precision decimal depths.
5. `20260928173553_add_document_storage`: Document metadata model with file hash uniqueness.
6. `20260928180136_add_drilling_events`: Drilling operational events with review status.
7. `20260928182237_enforce_confidence_and_audit_log`: Confidence constraints and audit log model.
8. `20260928184147_add_drilling_event_query_indexes`: Multi-column indexes for event querying.
9. `20260928195651_add_telemetry_readings`: Time-series telemetry readings with unique sequence constraints.
10. `20260928201925_add_alert_engine`: Alert rules, version snapshots, and alerts table.

Apply migrations to target database:

```bash
npx prisma migrate deploy
```

---

## 8. Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs at http://localhost:3000 (API endpoints under /api/v1)
```

---

## 9. Running Tests

The test suite runs with Vitest in parallel worker threads:

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npx vitest

# Run specific domain test suite
npx vitest tests/alerts/
```

---

## 10. Linting, Typecheck & Production Build

```bash
# Validate strict TypeScript compilation
npm run typecheck

# Execute ESLint verification
npm run lint

# Verify code formatting
npm run format:check

# Compile Next.js production build (Turbopack)
npm run build

# Start production server
npm run start
```

---

## 11. Authentication Architecture

- **Dual-Token Architecture:** Short-lived access JWT (1 hour) and long-lived persistent refresh token (7 days).
- **Session Tracking & Revocation:** Every login creates a `Session` record in PostgreSQL. Token refresh and API calls validate that the session has not been revoked.
- **Refresh Token Rotation:** On every refresh (`POST /api/v1/auth/refresh`), the old refresh token is invalidated, and a new token hash is written to the database. Replay of old tokens fails.
- **Secure Transport:** Delivered primarily via `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies, with Bearer header fallback for headless/programmatic API clients.
- **Timing Attack Resistance:** Bcrypt verification uses constant-time comparisons even when users do not exist.

---

## 12. Role-Based Access Control (RBAC) Matrix

NWIS enforces strict role-based access control across four domain roles:

| API Route Family                      | `VIEWER`          | `GEOLOGIST`         | `DRILLING_ENGINEER` | `ADMIN`            |
| ------------------------------------- | ----------------- | ------------------- | ------------------- | ------------------ |
| `GET /api/v1/wells` & sub-resources   | Read (`200`)      | Read (`200`)        | Read (`200`)        | Full (`200`)       |
| `POST/PATCH /api/v1/wells`            | Forbidden (`403`) | Write (`201`/`200`) | Write (`201`/`200`) | Full (`201`/`200`) |
| `GET /api/v1/documents/:id`           | Download (`200`)  | Download (`200`)    | Download (`200`)    | Download (`200`)   |
| `POST /api/v1/wells/:id/documents`    | Forbidden (`403`) | Upload (`201`)      | Upload (`201`)      | Upload (`201`)     |
| `GET /api/v1/events` & summary        | Read (`200`)      | Read (`200`)        | Read (`200`)        | Full (`200`)       |
| `POST /api/v1/wells/:id/events`       | Forbidden (`403`) | Create (`201`)      | Create (`201`)      | Full (`201`)       |
| `PATCH /api/v1/events/:id/review`     | Forbidden (`403`) | Review (`200`)      | Review (`200`)      | Full (`200`)       |
| `GET /api/v1/wells/:id/offsets`       | Read (`200`)      | Read (`200`)        | Read (`200`)        | Full (`200`)       |
| `POST /api/v1/telemetry/readings`     | Machine Key Only  | Machine Key Only    | Machine Key Only    | Machine Key Only   |
| `GET /api/v1/wells/:id/telemetry`     | Read (`200`)      | Read (`200`)        | Read (`200`)        | Full (`200`)       |
| `POST .../telemetry/evaluate`         | Forbidden (`403`) | Evaluate (`200`)    | Evaluate (`200`)    | Full (`200`)       |
| `GET /api/v1/alerts` & detail         | Read (`200`)      | Read (`200`)        | Read (`200`)        | Full (`200`)       |
| `POST /api/v1/alerts/:id/acknowledge` | Forbidden (`403`) | Forbidden (`403`)   | Acknowledge (`200`) | Full (`200`)       |
| `POST /api/v1/alerts/:id/resolve`     | Forbidden (`403`) | Forbidden (`403`)   | Resolve (`200`)     | Full (`200`)       |

---

## 13. Document APIs

- `POST /api/v1/wells/:wellId/documents`: Multipart form upload (`file`, `documentType`). Enforces magic-byte `%PDF-` validation, maximum 25 MB size limit, filename sanitization, content-hash deduplication, and failure compensation (rolls back physical storage if DB insert fails).
- `GET /api/v1/wells/:wellId/documents`: Lists documents for a well with validated `documentType` and `ingestionStatus` filters.
- `GET /api/v1/documents/:documentId`: Secure binary stream. Never accepts or leaks local filesystem paths. Emits `X-Content-Type-Options: nosniff` and `Content-Disposition: inline`.
- `GET /api/v1/documents/:documentId/metadata`: Returns metadata without downloading file payload.
- `GET /api/v1/documents/:documentId/events`: Returns drilling events extracted from this specific document.

---

## 14. Event APIs & Human Review Workflow

- `POST /api/v1/wells/:wellId/events`: Ingests candidate drilling events. Strict provenance check verifies `sourceDocumentId` exists and belongs to the target well. Status pinned to `PENDING_REVIEW`.
- `GET /api/v1/wells/:wellId/events`: Paginated event query with bounded pagination (max 100), depth filters (`minDepthMd`, `maxDepthMd`), severity, eventType, and sorting allowlist.
- `GET /api/v1/wells/:wellId/events/summary`: Deterministic database aggregation (total events, severity breakdown, NPT counts, shallowest/deepest occurrences).
- `GET /api/v1/events/:eventId`: Detailed event view including safe source document provenance.
- `PATCH /api/v1/events/:eventId/review`: Processes review decisions:
  - `APPROVE` -> Transitions to `APPROVED`.
  - `EDIT` -> Corrects event fields and transitions to `EDITED`.
  - `INVALIDATE` -> Marks event as `INVALIDATED` without deleting, preserving audit trail.
  - Reviewer ID and server timestamp are bound exclusively from authenticated session.

---

## 15. Offset-Well Intelligence APIs

- `GET /api/v1/wells/nearby`: Radial proximity search using spherical law of cosines / Haversine distance, bounded to radius $\le 50$ km.
- `GET /api/v1/wells/:wellId/offsets`: Multi-factor deterministic offset-well similarity discovery:
  1. **Spatial Proximity:** Calculates accurate geodesic distance (km).
  2. **Stratigraphic Formation Overlap:** Identifies matching formations, computing overlap top/bottom depths and interval length.
  3. **Depth Interval Overlap:** Quantifies borehole depth intersection between reference planned depth and candidate total depth.
  4. **Historical Event Evidence:** Aggregates verified drilling events in the candidate well.
  5. **Explainable Relevance Scoring:** Deterministic weighted formula combining distance decay, stratigraphic overlap, and event density. Completely free of black-box AI heuristics.

---

## 16. Telemetry Ingestion APIs

- `POST /api/v1/telemetry/readings`: Machine ingestion adapter.
  - Authenticated via `TELEMETRY_API_KEY` with constant-time buffer comparison (`crypto.timingSafeEqual`).
  - Idempotent via unique constraint `@@unique([wellId, sourceId, sequenceNumber])`. New reading returns `201 INGESTED`; duplicate returns `200 ALREADY_INGESTED`.
  - Tolerates out-of-order packet arrival by indexing and ordering by physical measurement `timestamp`.
  - Validates numeric boundaries (positive depths, finite numbers).
- `GET /api/v1/wells/:wellId/telemetry`: Retrieves chronological time-series readings with validated date ranges (`from <= to`), bounded pagination (`pageSize <= 200`), and sort order.

---

## 17. Alert Engine APIs

- `POST /api/v1/telemetry/readings/:readingId/evaluate`: Evaluates deterministic rules against a single reading + historical window.
- `POST /api/v1/wells/:wellId/telemetry/evaluate`: Evaluates readings in a bounded range:
  - Maximum window duration: **24 hours** (`MAX_EVALUATION_WINDOW_MS = 86,400,000 ms`).
  - Maximum readings limit: **100 readings** per evaluation.
  - Rejects `from > to` or duration $> 24$h with `400 Bad Request`.
- `GET /api/v1/wells/:wellId/alerts`: Lists paginated alerts with status, severity, and date filters.
- `GET /api/v1/alerts/:alertId`: Retrieves full alert detail, evidence snapshot, explanation, and timestamps.
- `POST /api/v1/alerts/:alertId/acknowledge`: Transitions `ACTIVE -> ACKNOWLEDGED`. Restricted to `DRILLING_ENGINEER` and `ADMIN`.
- `POST /api/v1/alerts/:alertId/resolve`: Transitions `ACKNOWLEDGED -> RESOLVED`. Direct `ACTIVE -> RESOLVED` rejected with `400 Bad Request`.

### Configured Demonstration Rules:

1. `PRESSURE_SPIKE_DETECT` (v1): `standpipePressure > 4500 psi` (Severity: `HIGH`).
2. `TORQUE_SPIKE_DETECT` (v1): `surfaceTorque > 18000 ft-lbf` (Severity: `HIGH`).
3. `MUD_FLOW_DISCREPANCY_DETECT` (v1): Sustained deficit `flowRateIn - flowRateOut > 50 gpm` across **3 consecutive chronological readings** (Severity: `CRITICAL`).

---

## 18. Audit Logging

Every state-changing or security-sensitive operation writes a persistent record to the `audit_logs` table:

- **Actions:** `USER_REGISTER`, `USER_LOGIN`, `USER_LOGOUT`, `WELL_CREATE`, `WELL_UPDATE`, `DOCUMENT_UPLOAD`, `EVENT_CREATE`, `EVENT_APPROVE`, `EVENT_EDIT`, `EVENT_INVALIDATE`, `ALERT_GENERATE`, `ALERT_ACKNOWLEDGE`, `ALERT_RESOLVE`.
- **Zero Secrets Guarantee:** Audit payloads are strictly sanitized. Passwords, JWT secrets, Bearer tokens, and session cookies are never recorded.

---

## 19. Security Considerations

- **CSRF Defense:** State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via browser cookies validate origin/referer against host headers and configured `TRUSTED_ORIGINS`. Programmatic Bearer requests are excluded.
- **HTTP Security Headers:** Configured via `next.config.ts`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `poweredByHeader: false` (removes `X-Powered-By: Next.js` fingerprinting)
- **Path Traversal Prevention:** Storage keys are server-generated UUIDs (`documents/{wellId}/{uuid}.pdf`). Original client filenames are sanitized for headers and never used as storage paths.
- **Bounded Inputs:** All pagination is capped (max 100 or 200 items), string lengths are bounded, and evaluation windows are capped at 24 hours.

---

## 20. Known Limitations

1. **Demonstration Thresholds:** Rule thresholds (4,500 psi, 18,000 ft-lbf, 50 gpm) are baseline demonstration values requiring domain calibration before well-site field deployment.
2. **Rule Pack Scope:** Initial engine seeds 3 deterministic demonstration rules. Additional drilling mechanics rules (vibration harmonics, pack-off ratios, ROP variations) will be packaged in future domain rule sets.
3. **Storage Backend:** Technical documents currently utilize a clean local filesystem storage abstraction. In cloud deployments, this adapter can be swapped with AWS S3 / Azure Blob Storage implementing the identical `IStorageService` interface.

---

## 21. Deferred AI/ML Integration

To maintain architectural stability and strict separation of concerns, the OCR extraction and ML incident prediction pipeline is isolated behind clean interfaces (`AI_ML_SERVICE_URL`). The backend provides full data models (`extractionConfidence`, `sourceDocumentId`, `sourcePage`) ready to ingest and record predictions once the dedicated AI/ML service is attached in subsequent phases.

---

## 22. Deferred Frontend Integration

The backend is completely headless and transport-ready. A separate Next.js web dashboard / frontend client can authenticate via HTTP-only cookies or Bearer JWTs, adhering to the documented OpenAPI contracts and CSRF/CORS origin configurations.
