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

---

## Step 11: Rule-Based Alert Engine

### Architecture & Design Principles

The NWIS Alert Engine is a deterministic, explainable, backend-only rule evaluation engine built directly upon the telemetry foundation of Step 10:

```text
TelemetryReading (PostgreSQL)
          ↓
RuleEvaluationService (Single reading or bounded time-series range)
          ↓
IAlertRuleRepository (PrismaAlertRuleRepository — Resolves active rule versions)
          ↓
IRuleEvaluator (DeterministicRuleEvaluator — Pure domain evaluation)
          ↓
EvaluationOutcome (Triggered / Not Triggered, Evidence Snapshot, Explanation)
          ↓
IAlertRepository (PrismaAlertRepository — Database-enforced idempotency)
          ↓
AuditLogService (Durable audit log: ALERT_GENERATE)
```

**Key Architectural Guarantees:**

- **Deterministic & Explainable:** Rule evaluation is a pure function of `(TelemetryReading, AlertRuleVersion)`. No AI, machine learning, probabilistic scoring, or random seeds are used.
- **Server-Side Templates:** Human-readable explanations are generated using deterministic templates capturing the exact rule name, observed value, unit, threshold condition, and timestamp.
- **Transport & Storage Decoupled:** Evaluation logic does not depend on HTTP, Next.js, or external message queues; it can be invoked manually via REST APIs or asynchronously by background workers.

---

### Initial Rule Set & Demonstration Thresholds

> [!IMPORTANT]
> **Domain Calibration Notice:**
> The threshold values listed below are **configurable demonstration defaults** established for development and deterministic testing. They are **NOT** claimed to be official Oil India Limited (OIL) engineering limits or authoritative field standards. Production deployments require formal calibration and sign-off by drilling domain experts.

1. **Pressure Spike Anomaly (`PRESSURE_SPIKE_DETECT`, v1.0.0)**
   - **Signal:** `standpipePressure` (psi)
   - **Condition:** `standpipePressure > 4500 psi`
   - **Severity:** `HIGH`
   - **Type:** Single-reading threshold evaluation
   - **Explanation Template:** `"Standpipe pressure of {observed} psi exceeded demonstration threshold of {threshold} psi."`

2. **Torque Spike Anomaly (`TORQUE_SPIKE_DETECT`, v1.0.0)**
   - **Signal:** `surfaceTorque` (ft-lbf)
   - **Condition:** `surfaceTorque > 18000 ft-lbf`
   - **Severity:** `HIGH`
   - **Type:** Single-reading threshold evaluation
   - **Explanation Template:** `"Surface torque of {observed} ft-lbf exceeded demonstration threshold of {threshold} ft-lbf."`

3. **Mud Flow Discrepancy Indicator (`MUD_FLOW_DISCREPANCY_DETECT`, v1.0.0)**
   - **Signal:** `flowRateIn` and `flowRateOut` (gpm)
   - **Condition:** `(flowRateIn - flowRateOut) > 50 gpm`
   - **Severity:** `MEDIUM`
   - **Type:** Paired-signal delta comparison
   - **Explanation Template:** `"Mud flow discrepancy: flow-in ({in} gpm) exceeds flow-out ({out} gpm) by {delta} gpm, exceeding threshold of {threshold} gpm (potential lost-circulation or pump imbalance indicator)."`

---

### Rule Versioning & Snapshotting

- Rules (`AlertRule`) and versions (`AlertRuleVersion`) have immutable behavioral identities.
- Active versions are marked via `isActive = true`.
- When an alert is triggered, it persists a full `evidence` JSON snapshot containing:
  - Exact rule version ID and version number
  - Target metric(s) and observed numeric values
  - Unit of measurement
  - Configured threshold value and operator
  - Measurement depth (`depthMd`) and measurement timestamp
- Modifying a rule's threshold in the future requires creating a new version; historical alerts remain permanently bound to their originating version and evidence snapshot.

---

### Alert Lifecycle State Machine

Alerts progress through a strictly enforced finite state machine:

```text
[ACTIVE] ──(acknowledge)──> [ACKNOWLEDGED] ──(resolve)──> [RESOLVED]
```

- **Transitions Permitted:**
  - `ACTIVE` → `ACKNOWLEDGED`
  - `ACKNOWLEDGED` → `RESOLVED`
- **Transitions Rejected (HTTP 400 Bad Request):**
  - `ACTIVE` → `RESOLVED` (Direct resolution requires prior acknowledgement)
  - `RESOLVED` → `ACTIVE` or `ACKNOWLEDGED` (Terminal state; no reopening)
  - `ACKNOWLEDGED` → `ACTIVE`
- **Metadata Recorded:**
  - `acknowledgedAt`, `acknowledgedById`
  - `resolvedAt`, `resolvedById`, `resolutionNote`

---

### Idempotency & Concurrency Safety

- **Database-Level Constraint:** `@@unique([telemetryReadingId, ruleVersionId], map: "uq_alert_reading_rule_version")`.
- Evaluating the same telemetry reading against the same active rule version multiple times will **never create duplicate alerts**.
- Concurrent evaluations racing on the same reading/rule pair are caught via PostgreSQL unique constraint violations (`P2002`) and resolved deterministically to the existing alert.

---

### Role-Based Access Control (RBAC)

| Role                | Read Alerts (`GET`) | Evaluate Telemetry (`POST`) | Acknowledge Alert (`POST`) | Resolve Alert (`POST`) |
| :------------------ | :-----------------: | :-------------------------: | :------------------------: | :--------------------: |
| `VIEWER`            |       Allowed       |      Forbidden (`403`)      |     Forbidden (`403`)      |   Forbidden (`403`)    |
| `GEOLOGIST`         |       Allowed       |      Forbidden (`403`)      |     Forbidden (`403`)      |   Forbidden (`403`)    |
| `DRILLING_ENGINEER` |       Allowed       |     Allowed (`200/201`)     |      Allowed (`200`)       |    Allowed (`200`)     |
| `ADMIN`             |       Allowed       |       Allowed (`201`)       |      Allowed (`200`)       |    Allowed (`200`)     |

---

### Audit Logging

Durable audit entries are emitted via `AuditLogService` using safe metadata:

- `ALERT_GENERATE`: Records `alertId`, `wellId`, `ruleCode`, `ruleVersionId`, `telemetryReadingId`, `severity`.
- `ALERT_ACKNOWLEDGE`: Records `alertId`, `previousStatus`, `newStatus`, `acknowledgedById`.
- `ALERT_RESOLVE`: Records `alertId`, `previousStatus`, `newStatus`, `resolvedById`, `hasResolutionNote`.
- **Zero Secrets:** No authorization tokens, API keys, passwords, or PII are logged.

---

### Alert Engine Endpoints

#### 1. Evaluate Single Telemetry Reading

- **Method:** `POST /api/v1/telemetry/readings/:readingId/evaluate`
- **Auth:** Session cookie or Bearer JWT (`ADMIN`, `DRILLING_ENGINEER`)
- **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### 2. Evaluate Telemetry Range for a Well

- **Method:** `POST /api/v1/wells/:wellId/telemetry/evaluate`
- **Auth:** Session cookie or Bearer JWT (`ADMIN`, `DRILLING_ENGINEER`)
- **Body:** `{ "from": "ISO8601", "to": "ISO8601", "maxReadings": 200 }` (max 500)
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### 3. List Well Alerts

- **Method:** `GET /api/v1/wells/:wellId/alerts`
- **Auth:** Authenticated user (`VIEWER`, `GEOLOGIST`, `DRILLING_ENGINEER`, `ADMIN`)
- **Query Params:** `status`, `severity`, `alertType`, `ruleCode`, `from`, `to`, `page`, `pageSize` (max 200), `sortOrder`
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`

#### 4. Get Alert Detail

- **Method:** `GET /api/v1/alerts/:alertId`
- **Auth:** Authenticated user (`VIEWER`, `GEOLOGIST`, `DRILLING_ENGINEER`, `ADMIN`)
- **Status Codes:** `200 OK`, `401 Unauthorized`, `404 Not Found`

#### 5. Acknowledge Alert

- **Method:** `POST /api/v1/alerts/:alertId/acknowledge`
- **Auth:** Session cookie or Bearer JWT (`ADMIN`, `DRILLING_ENGINEER`)
- **Status Codes:** `200 OK`, `400 Bad Request` (invalid transition), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### 6. Resolve Alert

- **Method:** `POST /api/v1/alerts/:alertId/resolve`
- **Auth:** Session cookie or Bearer JWT (`ADMIN`, `DRILLING_ENGINEER`)
- **Body:** `{ "resolutionNote": "Optional note (max 1000 chars)" }`
- **Status Codes:** `200 OK`, `400 Bad Request` (invalid transition), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`
