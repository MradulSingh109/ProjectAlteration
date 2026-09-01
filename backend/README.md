# SIH26034 Backend

## Project Description

The **SIH26034 Backend** is a compliance inspection engine for packaged commodities under the **Legal Metrology (Packaged Commodities) Rules, 2011**. 

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
|  PostgreSQL|                   |   OCR/AI Engine   |                          |   Redis   |
| (via Prisma)                   | (PaddleOCR/Vision)|                          | / BullMQ  |
+------------+                   +------------------+                          +-----------+
```

---

## Technology Stack

### Current (Step 1 Foundation & Step 2 Database)
* **Runtime**: Node.js
* **Language**: TypeScript
* **Web Framework**: Express.js
* **Database & ORM**: PostgreSQL & Prisma ORM (`@prisma/client`, `prisma`)
* **Validation**: Zod
* **Logging**: Pino & pino-pretty
* **Security Foundation**: Helmet, CORS
* **Environment Configuration**: dotenv with Zod validation
* **Execution/Build**: tsx (development runner), tsc (production build)

### Planned Technologies (Future Steps)
* **Asynchronous Queue & Jobs**: Redis, BullMQ
* **File Storage**: Object Storage (S3 / Local Storage Abstraction)
* **AI / OCR Integration**: OCR Interface (PaddleOCR / Google Vision / Custom CV models)
* **PDF & Report Generation**: PDFKit / Puppeteer

---

## Database Management (Prisma)

### Generate Prisma Client
```bash
npm run prisma:generate
```

### Apply Migrations
```bash
npm run prisma:migrate
```

### Seed Initial Database Data (Roles, Categories, Rules)
```bash
npm run prisma:seed
```

### Open Prisma Studio (GUI Database Management)
```bash
npm run prisma:studio
```

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

3. Ensure `.env` is configured properly with your PostgreSQL connection string:
   ```env
   NODE_ENV=development
   PORT=5000
   API_PREFIX=/api
   LOG_LEVEL=info
   CORS_ORIGIN=*
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sih26034_db?schema=public"
   ```

4. Generate Prisma client & seed database:
   ```bash
   npm run prisma:generate
   npm run prisma:seed
   ```

---

## Development & Production

### Development Server
Runs the TypeScript server with auto-reload:
```bash
npm run dev
```

### Build for Production
Compiles TypeScript into JavaScript inside the `dist/` directory:
```bash
npm run build
```

### Run Production Build
Starts the compiled JavaScript server from `dist/`:
```bash
npm run start
```

---

## API Documentation

### Health Check
Check application health status and environment configuration.

* **Endpoint**: `GET /api/health`
* **Response Format**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "service": "sih26034-backend",
      "environment": "development",
      "timestamp": "2026-09-02T00:00:00.000Z",
      "uptime": 1.452
    },
    "error": null
  }
  ```

---

## Project Structure

```text
backend/
├── prisma/
│   ├── schema.prisma   # PostgreSQL Prisma schema (14 models & relations)
│   └── seed.ts         # Initial roles, product categories & rule seeds
├── src/
│   ├── config/
│   │   ├── database.ts     # Centralized Prisma client singleton
│   │   ├── env.ts          # Zod environment variable validation
│   │   └── logger.ts       # Pino logger initialization
│   ├── controllers/
│   │   └── health.controller.ts # Health check controller
│   ├── middleware/
│   │   ├── errorHandler.ts # Global error handling middleware
│   │   └── notFound.ts     # 404 route not found handler
│   ├── routes/
│   │   ├── index.ts        # Central API router (/api)
│   │   └── health.routes.ts# Health check routes
│   ├── services/           # Service layer
│   ├── types/
│   │   └── api.types.ts    # Standard API response & payload interfaces
│   ├── utils/
│   │   ├── AppError.ts     # Custom operational error class
│   │   └── response.ts     # Standardized JSON response helpers
│   ├── app.ts              # Express application setup
│   └── server.ts           # Server bootstrap & graceful shutdown
├── ER_DIAGRAM.md           # Mermaid ER diagram & database architecture guide
├── tests/                  # Test suites placeholder
├── .env                    # Local environment secrets (Git ignored)
├── .env.example            # Environment template
├── .gitignore              # Git ignore rules
├── package.json            # Node.js dependencies & scripts
├── tsconfig.json           # TypeScript strict configuration
└── README.md               # Backend documentation
```

---

## Development Roadmap

- [x] **Step 1 — Foundation & Architecture**: Express, TypeScript, Zod env, Pino logging, Helmet, CORS, Error handling, Health check
- [x] **Step 2 — Database**: PostgreSQL & Prisma schema, ER diagram, versioned rule engine, seed data
- [ ] **Step 3 — Authentication**: User roles, JWT, Refresh Tokens
- [ ] **Step 4 — Inspection Management**: Inspection creation and entity relations
- [ ] **Step 5 — Image Upload & Storage**: Multi-part upload and storage provider abstraction
- [ ] **Step 6 — OCR Integration**: OCR provider interface and integration
- [ ] **Step 7 — Declaration Extraction**: Extracting mandatory packaging attributes
- [ ] **Step 8 — Rule Engine**: Configurable, versioned Legal Metrology rule validation
- [ ] **Step 9 — Compliance Results**: Evidence scoring and PASS / FAIL / REVIEW outcomes
- [ ] **Step 10 — Human Review**: Manual override and audit trail history
- [ ] **Step 11 — Reports**: PDF compliance report generation
- [ ] **Step 12 — Dashboard & Analytics**: Summary metrics and statistics
- [ ] **Step 13 — Testing & Security**: Integration tests, rate limiting, security hardening
- [ ] **Step 14 — Deployment**: Docker containerization and deployment setup
