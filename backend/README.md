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
