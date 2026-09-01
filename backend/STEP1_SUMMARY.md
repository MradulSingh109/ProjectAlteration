# SIH26034 Backend — Step 1 Architecture & Reference Guide

This document captures the complete architectural foundation, design patterns, folder structure, API contracts, and technology stack established in **Step 1: Project Foundation & Architecture**.

---

## 1. Project Location & Repository Context

* **Project Root**: `E:\SIH\sih-034\ProjectAlteration\backend`
* **Repository**: `https://github.com/MradulSingh109/ProjectAlteration.git`
* **Merged PR**: PR #1 (merged into `main`)
* **Git Ignored Items**: `.env`, `dist/`, `node_modules/`

---

## 2. Technology Stack Overview

| Category | Technology | Version / Configuration |
| :--- | :--- | :--- |
| **Runtime** | Node.js | v18+ |
| **Language** | TypeScript | `^5.7.3` (`"strict": true`, `"noImplicitAny": true`, `"outDir": "./dist"`) |
| **Web Framework** | Express.js | `^4.21.2` |
| **Validation Engine** | Zod | `^3.24.2` |
| **Logging** | Pino & pino-pretty | `^9.6.0` (Pino), `^13.0.0` (pino-pretty) |
| **Security** | Helmet & CORS | `^8.0.0` (Helmet), `^2.8.5` (CORS) |
| **Dev Environment** | tsx | `^4.19.3` (`npm run dev`) |
| **Compiler** | tsc | (`npm run build`) |

---

## 3. Directory Structure & File Map

```text
backend/
├── src/
│   ├── config/
│   │   ├── env.ts              # Zod environment variable validation
│   │   └── logger.ts           # Pino logger configuration
│   ├── controllers/
│   │   └── health.controller.ts# GET /api/health controller
│   ├── middleware/
│   │   ├── errorHandler.ts     # Global error handling middleware
│   │   └── notFound.ts         # 404 route not found handler
│   ├── routes/
│   │   ├── index.ts            # Central API router (/api)
│   │   └── health.routes.ts    # Health check routes
│   ├── services/               # Service layer directory placeholder
│   ├── types/
│   │   └── api.types.ts        # API contracts & response interfaces
│   ├── utils/
│   │   ├── AppError.ts         # Custom operational error class
│   │   └── response.ts         # Standardized JSON response helpers
│   ├── app.ts                  # Express application setup
│   └── server.ts               # Server bootstrap & graceful shutdown
├── tests/                      # Test suites directory placeholder
├── .env                        # Local environment file (Git ignored)
├── .env.example                # Template environment file
├── .gitignore                  # Git ignore configuration
├── package.json                # Dependencies and npm scripts
├── tsconfig.json               # TypeScript strict configuration
└── README.md                   # System documentation & roadmap
```

---

## 4. Architectural Rules & Standards for Future Steps

### A. API Response Format
All controllers and middleware MUST format JSON responses using `sendSuccess` or `sendError` from `src/utils/response.ts`.

* **Success Contract**:
  ```json
  {
    "success": true,
    "data": {},
    "error": null
  }
  ```

* **Error Contract**:
  ```json
  {
    "success": false,
    "data": null,
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human-readable error message",
      "details": []
    }
  }
  ```

### B. Error Handling Architecture
* Use `AppError` from `src/utils/AppError.ts` for operational errors:
  ```typescript
  throw AppError.badRequest('Invalid payload', 'INVALID_PAYLOAD');
  throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  throw AppError.unauthorized('Invalid credentials', 'UNAUTHORIZED');
  ```
* All unhandled exceptions and `AppError` instances automatically pass through `errorHandlerMiddleware` in `src/middleware/errorHandler.ts`.

### C. Application vs Server Separation
* **`app.ts`**: Express instance, middleware registration, routing, 404, and error handling. Do NOT call `.listen()` in `app.ts`.
* **`server.ts`**: Entry point calling `app.listen()`, managing environment loading, startup logging, and graceful shutdown signal handlers (`SIGINT`, `SIGTERM`).

### D. Environment Variable Rule
* All environment variables must be declared and validated in `src/config/env.ts` using Zod schema validation before being accessed anywhere in the codebase.

---

## 5. Development Roadmap Reference (Steps 1–14)

* [x] **Step 1 — Foundation & Architecture**: Express, TypeScript, Zod env, Pino logging, Helmet, CORS, Error handling, Health check
* [ ] **Step 2 — Database**: PostgreSQL & Prisma setup
* [ ] **Step 3 — Authentication**: User roles, JWT, Refresh Tokens
* [ ] **Step 4 — Inspection Management**: Inspection creation and entity relations
* [ ] **Step 5 — Image Upload & Storage**: Multi-part upload and storage provider abstraction
* [ ] **Step 6 — OCR Integration**: OCR provider interface and integration
* [ ] **Step 7 — Declaration Extraction**: Extracting mandatory packaging attributes
* [ ] **Step 8 — Rule Engine**: Configurable, versioned Legal Metrology rule validation
* [ ] **Step 9 — Compliance Results**: Evidence scoring and PASS / FAIL / REVIEW outcomes
* [ ] **Step 10 — Human Review**: Manual override and audit trail history
* [ ] **Step 11 — Reports**: PDF compliance report generation
* [ ] **Step 12 — Dashboard & Analytics**: Summary metrics and statistics
* [ ] **Step 13 — Testing & Security**: Integration tests, rate limiting, security hardening
* [ ] **Step 14 — Deployment**: Docker containerization and deployment setup
