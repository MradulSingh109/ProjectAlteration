# Nearby Wells Intelligence System (NWIS) — Backend

Backend API service for **Smart India Hackathon 2026 — Problem Statement 121 (Nearby Wells Intelligence System)**.

This is a headless backend application built using **Next.js (App Router)** and **TypeScript**, engineered around **Clean / Hexagonal Architecture** principles.

---

## Architecture Overview

The system isolates HTTP handling from domain and application use cases:

```text
HTTP / API (src/app/api/)
    ↓
Application Layer (src/application/)
    ↓
Domain Layer (src/domain/)
    ↓
Infrastructure Layer (src/infrastructure/)
```

### Directory Structure

```text
backend/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── v1/
│   │           └── health/route.ts      # Health check endpoint
│   ├── application/                     # Application use cases & service orchestration
│   ├── domain/                          # Core business models, entities & interfaces
│   ├── infrastructure/                  # External adapters, database repositories, clients
│   ├── lib/
│   │   ├── errors.ts                    # Standardized error definitions (AppError)
│   │   └── response.ts                  # Uniform API response helpers
│   └── config/
│       └── env.ts                       # Environment variable access & defaults
├── public/                              # Static public assets
├── tests/                               # Test suite
├── .env.example                         # Environment configuration template
├── .gitignore                           # Git ignore rules
├── .prettierrc                          # Prettier code style configuration
├── .prettierignore                      # Prettier ignore rules
├── eslint.config.mjs                    # ESLint flat configuration
├── next.config.ts                       # Next.js configuration
├── package.json                         # Dependencies and npm scripts
└── tsconfig.json                        # Strict TypeScript configuration
```

---

## Available Scripts

| Script                 | Command                | Purpose                               |
| :--------------------- | :--------------------- | :------------------------------------ |
| `npm run dev`          | `next dev`             | Start development server on port 3000 |
| `npm run build`        | `next build`           | Compile production build              |
| `npm run start`        | `next start`           | Start compiled production server      |
| `npm run lint`         | `eslint .`             | Run ESLint checks across codebase     |
| `npm run format`       | `prettier --write ...` | Auto-format codebase using Prettier   |
| `npm run format:check` | `prettier --check ...` | Verify code formatting compliance     |
| `npm run typecheck`    | `tsc --noEmit`         | Strict TypeScript type validation     |

---

## Baseline API

### Health Check

- **Endpoint:** `GET /api/v1/health`
- **Authentication:** None
- **Response Format:**
  ```json
  {
    "status": "ok",
    "service": "nwis-backend",
    "version": "0.1.0",
    "timestamp": "2026-09-27T10:30:00.000Z"
  }
  ```

---

## Step 10: Telemetry Ingestion Foundation

### Architecture & Transport-Independence

The real-time drilling telemetry ingestion system is built around a transport-independent architecture. The production OIL telemetry transport/protocol is **not finalized yet** (e.g. MQTT, Kafka, WITSML, or WITS0).

Therefore, the core domain and application services remain strictly transport-agnostic:

```text
External Telemetry Source (Dev/Rig Stream)
         ↓
Transport Adapter (HttpTelemetryAdapter for dev/testing; swap with MQTT/Kafka later)
         ↓
Canonical CreateTelemetryInput
         ↓
TelemetryIngestionService (Validates Well, Idempotency, Audit Log)
         ↓
ITelemetryRepository (PrismaTelemetryRepository)
         ↓
PostgreSQL on Neon (telemetry_readings)
```

### Canonical Telemetry Contract

Each telemetry reading consists of:

- `wellId` (UUID): Reference to target well in `wells` table.
- `sourceId` (string): Originating telemetry rig/sensor stream identifier.
- `sequenceNumber` (integer): Source packet monotonic sequence identifier used for idempotency.
- `timestamp` (ISO 8601 UTC): Physical measurement timestamp recorded downhole/at rig.
- `measurements` (object): Physical drilling measurements (stored as PostgreSQL Decimals):
  - `depthMd` (meters, required non-negative number)
  - `depthTvd` (meters, optional)
  - `rateOfPenetration` (m/hr, optional)
  - `hookLoad` (klbf, optional)
  - `standpipePressure` (psi, optional)
  - `annularPressure` (psi, optional)
  - `surfaceTorque` (ft-lbf, optional)
  - `rotaryRpm` (RPM, optional)
  - `flowRateIn` (gpm, optional)
  - `flowRateOut` (gpm, optional)
  - `mudDensity` (ppg, optional)
- `metadata` (optional JSON): Extensible key-value metadata up to 64KB.

### Timestamp Semantics & Out-of-Order Handling

- **Measurement Timestamp (`timestamp`):** The real physical time downhole/on-surface when the reading was taken. Always UTC-aware.
- **Ingestion Timestamp (`ingestedAt`):** Server arrival timestamp recorded automatically by PostgreSQL.
- **Out-of-Order Readings:** Due to network lag, packets may arrive out of order. Out-of-order readings are fully persisted and never rejected purely based on older timestamps. Queries retrieve data strictly ordered by measurement `timestamp ASC` (or `DESC`).

### Idempotency Strategy

- Enforced at the database level via unique constraint: `@@unique([wellId, sourceId, sequenceNumber], map: "uq_telemetry_well_source_seq")`.
- **First ingestion:** Returns `201 Created` with `status: "INGESTED"`, `isDuplicate: false`.
- **Replay/Duplicate:** Returns `200 OK` with `status: "ALREADY_INGESTED"`, `isDuplicate: true`, returning the existing record deterministically without creating duplicate records or throwing 500 errors.
- **Race conditions:** Database constraint `uq_telemetry_well_source_seq` catches concurrent inserts with Prisma `P2002` error and cleanly resolves to the existing record.

### Ingestion Authentication

- Machine-to-backend authentication using dedicated `TELEMETRY_API_KEY` (minimum 16 characters).
- Provided via `x-telemetry-api-key` or `Authorization: Bearer <key>` header.
- Validated via constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
- Isolated from human session cookie authentication and RBAC.

### Database Indexes

1. `uq_telemetry_well_source_seq` (`well_id`, `source_id`, `sequence_number`): Guarantees uniqueness and instant lookup for idempotency checks.
2. `idx_telemetry_well_timestamp` (`well_id`, `timestamp`): Optimized for time-series range filtering and chronological ordering for a specific well.
3. `idx_telemetry_timestamp` (`timestamp`): Enables efficient fleet-wide chronological queries and future time-series retention windows.

### Endpoints

#### 1. Ingest Telemetry Reading

- **Method:** `POST /api/v1/telemetry/readings`
- **Auth:** Machine API key (`x-telemetry-api-key`)
- **Status Codes:**
  - `201 Created`: Successfully ingested.
  - `200 OK`: Duplicate packet recognized and idempotently handled (`ALREADY_INGESTED`).
  - `400 Bad Request`: Payload validation failed (NaN, Infinity, negative depths, malformed timestamp).
  - `401 Unauthorized`: Missing or invalid machine API key.
  - `404 Not Found`: Referenced well does not exist.

#### 2. Query Well Telemetry Time-Series

- **Method:** `GET /api/v1/wells/:wellId/telemetry`
- **Auth:** Authenticated user session cookie / Bearer token (accessible to `VIEWER`, `GEOLOGIST`, `DRILLING_ENGINEER`, `ADMIN`).
- **Query Parameters:**
  - `from` (ISO 8601 UTC string, optional): Earliest timestamp.
  - `to` (ISO 8601 UTC string, optional): Latest timestamp.
  - `page` (integer, default `1`): 1-indexed page.
  - `pageSize` (integer, default `50`, max `200`): Results per page.
  - `sortOrder` (`"asc"` | `"desc"`, default `"asc"`): Order by measurement timestamp.
- **Status Codes:**
  - `200 OK`: Paginated time-series telemetry.
  - `400 Bad Request`: Invalid parameters (e.g. `from > to`, `pageSize > 200`).
  - `401 Unauthorized`: User not authenticated.
  - `404 Not Found`: Well not found.
