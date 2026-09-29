# NWIS — Nearby Wells Intelligence System

Three-Domain Engineering Plan: Frontend • Backend • ML/AI

Prepared from a Senior Development Team Lead perspective | Architecture, repository structure, work breakdown, interfaces, dependencies, and implementation sequence.

## 1. Executive Architecture

NWIS is an intelligence layer that sits alongside OIL's existing real-time drilling environment. The three teams are deliberately separated: Frontend owns user experience and visualization; Backend owns data, APIs, orchestration, authentication, persistence, and real-time delivery; ML owns document intelligence, NLP, embeddings/RAG, feature engineering, risk models, and model lifecycle.

```text
                         ┌──────────────────────────────┐
                         │          FRONTEND             │
                         │ React + Vite + Tailwind       │
                         │ Map + Well UI + Alerts + RAG  │
                         └──────────────┬───────────────┘
                                        │ REST / WebSocket
                                        ▼
                         ┌──────────────────────────────┐
                         │           BACKEND             │
                         │ FastAPI + Auth + Services     │
                         │ PostgreSQL/PostGIS + pgvector │
                         │ Document/ETL + Event Engine   │
                         └───────┬───────────────┬──────┘
                                 │               │
                        ML API / jobs      Real-time stream
                                 │               │
                                 ▼               ▼
                         ┌──────────────────────────────┐
                         │             ML/AI             │
                         │ OCR + NLP + Embeddings/RAG    │
                         │ Similarity + Risk Models      │
                         │ MLflow + DVC + Model Registry │
                         └──────────────────────────────┘
```

## 2. Team Ownership

| **Domain** | **Primary ownership** | **Must NOT own** |
|---|---|---|
| Frontend | Screens, map, charts, forms, state, API integration, alert presentation, UX validation | Business-critical persistence, model training, direct DB access |
| Backend | API contracts, auth, DB, GIS queries, document pipeline orchestration, event/risk orchestration, WebSockets, audit logs | UI rendering, model-training internals |
| ML/AI | OCR/NLP, extraction schemas, embeddings, retrieval, similarity, feature engineering, risk models, evaluation, MLflow/DVC | Direct frontend integration, user auth, primary transactional DB ownership |

## 3. Monorepo Folder Structure

```text
nwis/
│
├── README.md
├── .env.example
├── docker-compose.yml
├── Makefile
├── .gitignore
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── public/
│   └── src/
│       ├── app/
│       │   ├── router.jsx
│       │   ├── providers.jsx
│       │   └── store.js
│       ├── components/
│       │   ├── ui/
│       │   ├── map/
│       │   ├── wells/
│       │   ├── drilling/
│       │   ├── alerts/
│       │   ├── risk/
│       │   └── documents/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── WellMap.jsx
│       │   ├── WellDetails.jsx
│       │   ├── EventExplorer.jsx
│       │   ├── Documents.jsx
│       │   ├── KnowledgeAssistant.jsx
│       │   ├── RiskDashboard.jsx
│       │   └── Admin.jsx
│       ├── features/
│       │   ├── activeWell/
│       │   ├── nearbyWells/
│       │   ├── historicalEvents/
│       │   ├── riskMonitoring/
│       │   └── aiAssistant/
│       ├── api/
│       │   ├── client.js
│       │   ├── wells.api.js
│       │   ├── events.api.js
│       │   ├── documents.api.js
│       │   ├── risk.api.js
│       │   └── assistant.api.js
│       ├── hooks/
│       ├── lib/
│       ├── utils/
│       ├── types/
│       └── tests/
│
├── backend/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── migrations/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py
│   │   │   │   ├── wells.py
│   │   │   │   ├── formations.py
│   │   │   │   ├── events.py
│   │   │   │   ├── documents.py
│   │   │   │   ├── risk.py
│   │   │   │   ├── assistant.py
│   │   │   │   └── realtime.py
│   │   │   └── schemas/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   │   ├── well_service.py
│   │   │   ├── gis_service.py
│   │   │   ├── event_service.py
│   │   │   ├── document_service.py
│   │   │   ├── risk_service.py
│   │   │   └── assistant_service.py
│   │   ├── ml_gateway/
│   │   │   ├── client.py
│   │   │   └── schemas.py
│   │   ├── realtime/
│   │   ├── workers/
│   │   └── utils/
│   └── tests/
│
├── ml/
│   ├── README.md
│   ├── requirements.txt
│   ├── configs/
│   │   ├── extraction.yaml
│   │   ├── embeddings.yaml
│   │   ├── similarity.yaml
│   │   └── risk_models.yaml
│   ├── data/
│   │   ├── raw/
│   │   ├── interim/
│   │   ├── processed/
│   │   └── external/
│   ├── pipelines/
│   │   ├── ingest_documents.py
│   │   ├── ocr_pipeline.py
│   │   ├── extraction_pipeline.py
│   │   ├── embedding_pipeline.py
│   │   ├── feature_pipeline.py
│   │   └── training_pipeline.py
│   ├── src/
│   │   ├── ocr/
│   │   ├── nlp/
│   │   ├── extraction/
│   │   ├── embeddings/
│   │   ├── retrieval/
│   │   ├── similarity/
│   │   ├── features/
│   │   ├── risk/
│   │   │   ├── mud_loss/
│   │   │   ├── stuck_pipe/
│   │   │   ├── kick/
│   │   │   ├── overpressure/
│   │   │   ├── torque_anomaly/
│   │   │   └── cementing/
│   │   └── evaluation/
│   ├── models/
│   │   ├── trained/
│   │   └── artifacts/
│   ├── notebooks/
│   ├── tests/
│   ├── dvc.yaml
│   ├── params.yaml
│   └── mlflow/
│
├── contracts/
│   ├── openapi.yaml
│   ├── event_schema.json
│   ├── risk_schema.json
│   ├── well_schema.json
│   └── realtime_schema.json
│
└── docs/
    ├── architecture/
    ├── api/
    ├── database/
    ├── ml/
    ├── frontend/
    └── runbooks/
```

## 4. Shared Engineering Contract

The three teams should never integrate by guessing fields. Every cross-domain object is defined first in contracts/. Backend owns the API implementation; ML owns prediction/extraction semantics; Frontend consumes the contract.

| **Contract** | **Produced by** | **Consumed by** | **Minimum fields** |
|---|---|---|---|
| Well | Backend | Frontend + ML | well_id, name, lat, lon, field, formation, status |
| Nearby Well | Backend | Frontend | well_id, distance_m, similarity_score, formation_match |
| Historical Event | ML → Backend | Frontend + ML | event_id, well_id, type, depth_md, formation, severity, evidence |
| Risk Prediction | ML → Backend | Frontend | risk_type, probability, level, depth, model_version, evidence |
| RAG Answer | ML → Backend | Frontend | answer, sources, confidence/limitations |
| Realtime Parameter | Backend | Frontend + ML | timestamp, well_id, depth, parameter, value |

## 5. Detailed Step-by-Step Implementation Plan

### Phase 0 — Architecture and Contracts

1. Backend team defines PostgreSQL/PostGIS domain entities and identifiers.
2. ML team defines extraction, event, embedding, feature, and prediction schemas.
3. Frontend team converts the agreed API schemas into frontend data models and mock fixtures.
4. All three teams agree on units: depth MD/TVD, pressure units, mud density units, timestamps, coordinate reference system, and event severity vocabulary.
5. Create OpenAPI and JSON schema contracts before feature implementation.
6. Create synthetic seed data representing wells, formations, drilling parameters, and historical events so all teams can work without OIL production data.

Dependency: Nothing should proceed to deep implementation until the IDs, units, event taxonomy, and API shapes are frozen.

### Phase 1 — Repository and Local Environment

- Backend: FastAPI service, PostgreSQL/PostGIS, pgvector, Alembic, Redis, background worker setup.
- ML: isolated Python environment, DVC repository, MLflow tracking, reproducible config system.
- Frontend: Vite React application, Tailwind/shadcn UI, routing, query/cache layer, map library.
- DevOps: Docker Compose for frontend, backend, database, vector search, Redis and ML service.
- Create a one-command local startup and health-check endpoints.

### Phase 2 — Well and GIS Foundation

Goal: deliver the first useful vertical slice: select a well → see it on a map → find nearby wells.

- Backend: create wells, locations, trajectory, formation tables and PostGIS indexes.
- Backend: implement GET /wells, GET /wells/{id}, GET /wells/{id}/nearby?radius_km=.
- Backend: return distance, formation match and basic metadata.
- Frontend: build map screen, active-well selector, radius control, well markers and detail drawer.
- Frontend: add loading/error/empty states and map-to-detail navigation.
- ML: prepare geological similarity feature definitions but do not yet train a risk model.
- Integration test: frontend map must work entirely against backend seed data.

### Phase 3 — Document Intelligence

Goal: turn WCRs/DDRs and other historical documents into structured institutional memory.

- ML: classify document type and detect native-text versus scanned PDF.
- ML: implement OCR for scanned pages and preserve page/source references.
- ML: extract text, tables, dates, well IDs, depths, formations, drilling parameters and event phrases.
- ML: normalize event types: mud loss, kick, stuck pipe, fishing, NPT, torque spike, cementing issue, etc.
- ML: attach every extracted fact to source document/page/section for auditability.
- Backend: create documents, extracted_entities, drilling_events and lessons_learned tables.
- Backend: expose document upload/status/result APIs and ingestion job status.
- Frontend: create document upload, processing status and extracted-event review screens.
- Integration test: upload a sample PDF → process → event appears against the correct well/depth → UI can open source evidence.

### Phase 4 — Historical Correlation Engine

Goal: correlate active-well depth/formation with offset-well experience.

- Backend: query wells inside radius using PostGIS.
- ML: calculate geological/formation/depth similarity features.
- ML: rank offset wells by similarity rather than distance alone.
- Backend: combine GIS proximity and ML similarity into a single Nearby Well Intelligence response.
- Frontend: show nearby wells ranked by relevance; allow filtering by formation, event type and depth interval.
- Frontend: create depth timeline for the active well with historical events from offsets.
- Integration test: at a selected active-well depth, the UI shows relevant historical events and source evidence.

### Phase 5 — RAG Knowledge Assistant

- ML: chunk extracted historical text using document/section/depth-aware chunking.
- ML: generate embeddings and store/retrieve through pgvector.
- ML: implement retrieval with metadata filters for field, well, formation, depth and event type.
- ML: generate answers only from retrieved evidence and return citations/source IDs.
- Backend: expose assistant query endpoint and conversation/session handling.
- Frontend: build AI assistant panel with answer, cited documents, relevant wells and confidence/limitations.
- Integration test: ask a historical question and verify every factual answer maps to retrievable source evidence.

### Phase 6 — Predictive Risk Models

Start with one risk model. Recommended first target: mud-loss prediction, followed by stuck pipe and kick when sufficient labeled data exists.

- ML: define prediction target and prediction horizon.
- ML: build time/depth aligned training rows from drilling parameters and historical events.
- ML: engineer drilling, mud, formation, offset-well and trajectory features.
- ML: prevent leakage by splitting data by well/time rather than randomly mixing rows from the same well.
- ML: establish a baseline model before advanced models.
- ML: compare Logistic Regression/Random Forest/XGBoost or equivalent baselines as appropriate.
- ML: evaluate precision, recall, PR-AUC/ROC-AUC, false-alert rate and calibration; report by well/formation where possible.
- MLflow: track datasets, parameters, metrics, model versions and artifacts.
- DVC: version datasets and reproducible training pipeline.
- Backend: create risk prediction service/gateway with model version metadata.
- Frontend: create risk dashboard and depth-based risk indicators.

### Phase 7 — Real-Time Intelligence

- Backend: define real-time ingestion adapter for the eRTMAC-compatible stream/interface.
- Backend: normalize incoming measurements into the canonical realtime schema.
- Backend: maintain current active-well state and broadcast updates via WebSocket.
- ML: implement online feature transformation using the same definitions as training.
- ML: run inference at a controlled cadence and produce risk predictions.
- Backend: apply alert rules, deduplication, severity thresholds and audit logging.
- Frontend: show live drilling parameters, live risk status, alert feed and historical context together.
- Integration test: simulated stream → backend → ML inference → alert engine → frontend alert.

### Phase 8 — Decision Support and Recommendations

- ML/Backend: combine historical evidence, similarity and model output into an explainable alert object.
- Do not present an ML probability alone; show the evidence that caused the alert.
- Frontend: provide alert detail with current depth, similar wells, historical events, model version and source documents.
- Add recommendation templates tied to documented historical mitigation measures; do not invent operational procedures.
- Add acknowledgement, escalation and audit trail for alerts.

## 6. Frontend Work Breakdown

| **Step** | **Deliverable** | **Depends on backend/ML** |
|---|---|---|
| F1 | App shell, routing, design system | None |
| F2 | Login/RBAC UI | Auth endpoints |
| F3 | Dashboard shell | Well/status endpoints |
| F4 | Interactive well map | Well + GIS APIs |
| F5 | Nearby well intelligence | Nearby API + similarity fields |
| F6 | Well detail/depth timeline | Well/event APIs |
| F7 | Document explorer | Document APIs |
| F8 | Historical event explorer | Extracted event schema |
| F9 | RAG assistant | Assistant API |
| F10 | Risk dashboard | Risk API |
| F11 | Realtime monitoring | WebSocket/realtime schema |
| F12 | Alerts and audit UI | Alert API |
| F13 | Performance/accessibility/polish | Stable APIs |

## 7. Backend Work Breakdown

| **Step** | **Deliverable** | **Consumed/produced** |
|---|---|---|
| B1 | Database + PostGIS schema | Well/event/document/risk entities |
| B2 | Auth + RBAC | Frontend |
| B3 | Well/GIS APIs | Frontend + ML |
| B4 | Document ingestion APIs | Frontend + ML workers |
| B5 | Event/lesson persistence | ML → DB → Frontend |
| B6 | Similarity orchestration | ML + GIS → Frontend |
| B7 | Vector/RAG gateway | ML ↔ Frontend |
| B8 | Risk gateway | ML → Frontend |
| B9 | Realtime adapter/WebSockets | eRTMAC → ML + Frontend |
| B10 | Alert engine/audit | ML + Frontend |
| B11 | Observability/security | All domains |

## 8. ML/AI Work Breakdown

| **Step** | **Deliverable** | **Backend/Frontend impact** |
|---|---|---|
| M1 | Document/OCR pipeline | Produces document status + extracted data |
| M2 | NLP entity/event extraction | Produces event schema |
| M3 | Source/evidence linking | Enables traceable UI |
| M4 | Embeddings + retrieval | Powers assistant |
| M5 | Well similarity | Powers offset ranking |
| M6 | Feature engineering | Shared with realtime inference |
| M7 | Mud-loss baseline/model | Risk API |
| M8 | Additional risk models | Risk API |
| M9 | Evaluation + explainability | Alert evidence |
| M10 | MLflow/DVC/model registry | Production model lifecycle |

## 9. Critical API Surface

```text
GET    /api/v1/wells
GET    /api/v1/wells/{well_id}
GET    /api/v1/wells/{well_id}/nearby?radius_km=10
GET    /api/v1/wells/{well_id}/events
GET    /api/v1/wells/{well_id}/timeline?depth_from=&depth_to=

POST   /api/v1/documents
GET    /api/v1/documents/{document_id}
GET    /api/v1/documents/{document_id}/status

POST   /api/v1/assistant/query
POST   /api/v1/risk/predict
GET    /api/v1/risk/{well_id}
GET    /api/v1/alerts
POST   /api/v1/alerts/{alert_id}/acknowledge

WS     /api/v1/realtime/wells/{well_id}
```

## 10. Example Cross-Domain Flow: Mud-Loss Alert

```text
1. eRTMAC/stream sends:
   depth=2848m, ROP=..., torque=..., flow=..., mud_weight=...

2. BACKEND:
   validates + normalizes data
   → stores/streams current state
   → sends canonical feature payload to ML

3. ML:
   calculates current features
   + formation
   + offset-well history
   + similarity features
   → model inference

4. ML returns:
   risk_type=MUD_LOSS
   probability=0.78
   level=HIGH
   model_version=...
   evidence=[offset events...]

5. BACKEND:
   applies alert policy
   → persists alert
   → pushes WebSocket event

6. FRONTEND:
   updates live risk card
   → highlights depth interval
   → shows historical offset evidence
   → allows engineer to open source reports
```

## 11. Data and Model Governance

- Every extracted fact must retain provenance: document ID, page/section, extraction timestamp and model/pipeline version.
- Every prediction must retain model version, feature version, timestamp and input context needed for audit.
- Use role-based access for sensitive operational data.
- Never allow an LLM response to silently overwrite structured operational records.
- Keep human review for low-confidence extraction and high-impact recommendations.
- Separate training data, validation data and production data.
- Prefer well-wise/time-wise evaluation to avoid data leakage.
- Log model drift and alert-rate changes after deployment.

## 12. Definition of Done

| **Domain** | **Definition of done** |
|---|---|
| Frontend | Every production screen consumes typed/validated API responses, handles loading/error states, supports the core engineer workflow, and has component/integration tests. |
| Backend | APIs are documented, authenticated where required, validated, tested, logged, observable, migration-controlled, and return stable contract-compliant schemas. |
| ML | Pipeline is reproducible, dataset/model versions are tracked, metrics are documented, predictions are explainable enough for the UI, and inference has a stable service contract. |
| System | Synthetic end-to-end scenario works: active well → nearby wells → historical events → risk inference → alert → evidence/source → engineer acknowledgement. |

## 13. Recommended Team Parallelization

Do not make the teams work in a strictly serial manner. Work in vertical slices with a contract-first approach.

```text
WEEK / SPRINT        FRONTEND             BACKEND                 ML
────────────────────────────────────────────────────────────────────────
Sprint 1             App shell            DB + API skeleton       Schemas + data prep
Sprint 2             Map + mock data       Well/GIS APIs           Similarity prototype
Sprint 3             Well details          Document APIs           OCR/NLP extraction
Sprint 4             Events/timeline       Event persistence       Event extraction
Sprint 5             RAG UI                Assistant gateway      Embeddings/RAG
Sprint 6             Risk UI               Risk gateway            First risk model
Sprint 7             Live UI               Realtime/WebSocket      Realtime inference
Sprint 8             Alerts/polish         Alert/audit engine      Explainability/eval
Sprint 9+            Hardening             Security/observability  Model validation/drift
```

## 14. Senior Team Lead Rules

- One source of truth for contracts: contracts/openapi.yaml and JSON schemas.
- No frontend team member queries the database directly.
- No ML notebook becomes production code without being converted into a tested pipeline/module.
- No model is integrated before its input/output schema and evaluation report exist.
- No RAG answer is considered production-ready without source evidence.
- No risk alert is shown without timestamp, model version and evidence/context.
- Use feature flags for incomplete capabilities.
- Merge small pull requests; require tests and code review per domain.
- Maintain synthetic data so development continues even when OIL data is unavailable.
- Build one complete vertical slice early rather than six disconnected demos.

## 15. Final End-to-End Product Flow

```text
Historical WCR / DDR / Mud Report
          │
          ▼
       ML/OCR/NLP
          │
          ▼
Structured Events ───────────────┐
          │                      │
          ▼                      ▼
     Backend DB              Vector DB
          │                      │
          └──────────┬───────────┘
                     ▼
              Similarity Engine
                     │
Active Well ──► Nearby Wells + Historical Context
                     │
                     ▼
              Current eRTMAC Data
                     │
                     ▼
              Feature Engineering
                     │
                     ▼
                 ML Risk
                     │
                     ▼
               Alert Engine
                     │
                     ▼
                 FRONTEND
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
        Map       Risk       AI Assistant
          │          │          │
          └──────────┴──────────┘
                     ▼
            Drilling Engineer
```

## 16. Immediate Build Order

1. Freeze shared schemas and IDs.
2. Create monorepo and Docker development environment.
3. Create PostgreSQL/PostGIS schema and synthetic seed dataset.
4. Build Backend well/GIS APIs.
5. Build Frontend map and nearby-well screen.
6. Build ML document extraction pipeline on representative PDFs.
7. Persist extracted events and connect them to wells/depths.
8. Build Frontend historical event timeline.
9. Build ML similarity engine and connect it to nearby-well ranking.
10. Build RAG retrieval and assistant.
11. Create first mud-loss dataset and baseline model.
12. Expose risk inference through Backend.
13. Build real-time simulation before connecting actual eRTMAC.
14. Connect real-time inference → alert engine → Frontend.
15. Add auditability, RBAC, testing, monitoring and deployment hardening.

This plan deliberately keeps Frontend, Backend, and ML independently deployable while forcing integration through explicit contracts. The first milestone should be the GIS vertical slice; the second should be historical institutional memory; the third should be predictive risk; the final milestone should be real-time decision support.