# SIH26034 Database Architecture & Entity Relationship Diagram

This document contains the complete database schema architecture, Entity Relationship (ER) diagram, entity definitions, and relationship cardinalities for **SIH26034** (Legal Metrology Packaged Commodities Rule Compliance Engine).

---

## 1. System ER Diagram (Mermaid)

```mermaid
erDiagram
    ROLE ||--o{ USER : "assigned to"
    USER ||--o{ INSPECTION : "creates"
    USER ||--o{ REPORT : "generates"
    USER ||--o{ AUDIT_LOG : "triggers"

    PRODUCT_CATEGORY ||--o{ PRODUCT : "classifies"
    PRODUCT ||--o{ INSPECTION : "inspected in"

    INSPECTION ||--o{ INSPECTION_IMAGE : "contains"
    INSPECTION_IMAGE ||--o{ OCR_RESULT : "produces"
    INSPECTION ||--o{ DECLARATION : "contains"
    INSPECTION_IMAGE ||--o{ DECLARATION : "sources"

    RULE ||--o{ RULE_VERSION : "versioned as"
    RULE_VERSION ||--o{ RULE_VERSION_CATEGORY : "applies to"
    PRODUCT_CATEGORY ||--o{ RULE_VERSION_CATEGORY : "governed by"

    RULE_VERSION ||--o{ VALIDATION_RESULT : "evaluates"
    INSPECTION ||--o{ VALIDATION_RESULT : "evaluated by"

    VALIDATION_RESULT ||--o{ VIOLATION : "triggers"
    INSPECTION ||--o{ VIOLATION : "flagged with"

    VIOLATION ||--o{ EVIDENCE : "supported by"
    INSPECTION_IMAGE ||--o{ EVIDENCE : "referenced in"
    OCR_RESULT ||--o{ EVIDENCE : "referenced in"
    DECLARATION ||--o{ EVIDENCE : "referenced in"

    INSPECTION ||--o{ REPORT : "summarized in"

    ROLE {
        uuid id PK
        RoleCode code UK
        string name
    }

    USER {
        uuid id PK
        string email UK
        string passwordHash
        uuid roleId FK
        boolean isActive
    }

    PRODUCT_CATEGORY {
        uuid id PK
        string code UK
        string name
    }

    PRODUCT {
        uuid id PK
        string name
        string brandName
        uuid categoryId FK
    }

    INSPECTION {
        uuid id PK
        string inspectionNumber UK
        uuid productId FK
        uuid createdBy FK
        WorkflowStatus workflowStatus
        ComplianceStatus complianceStatus
        timestamptz inspectedAt
    }

    INSPECTION_IMAGE {
        uuid id PK
        uuid inspectionId FK
        string fileUrl
        ImageType imageType
    }

    OCR_RESULT {
        uuid id PK
        uuid inspectionImageId FK
        string provider
        string rawText
        float confidence
        json boundingBoxes
    }

    DECLARATION {
        uuid id PK
        uuid inspectionId FK
        DeclarationType type
        DeclarationSource source
        string rawValue
        string normalizedValue
        float confidence
        boolean isHumanReviewed
    }

    RULE {
        uuid id PK
        string code UK
        string name
        boolean isActive
    }

    RULE_VERSION {
        uuid id PK
        uuid ruleId FK
        int version
        timestamptz effectiveFrom
        json configuration
    }

    RULE_VERSION_CATEGORY {
        uuid id PK
        uuid ruleVersionId FK
        uuid categoryId FK
    }

    VALIDATION_RESULT {
        uuid id PK
        uuid inspectionId FK
        uuid ruleVersionId FK
        ValidationStatus status
        string message
    }

    VIOLATION {
        uuid id PK
        uuid inspectionId FK
        uuid validationResultId FK
        ViolationSeverity severity
        ViolationStatus status
    }

    EVIDENCE {
        uuid id PK
        uuid violationId FK
        uuid imageId FK
        uuid ocrResultId FK
        uuid declarationId FK
        EvidenceType type
        json metadata
    }

    REPORT {
        uuid id PK
        uuid inspectionId FK
        uuid generatedBy FK
        ReportType reportType
    }

    AUDIT_LOG {
        uuid id PK
        uuid userId FK
        string action
        string entityType
        string entityId
        json oldValue
        json newValue
    }
```

---

## 2. Major Database Entities & Purpose

| Entity | Purpose / Description | Primary Key | Key Foreign Keys |
| :--- | :--- | :--- | :--- |
| **`Role`** | Role-Based Access Control (ADMIN, INSPECTOR, REVIEWER). | `id` (UUID) | None |
| **`User`** | System user accounts with hashed credentials and assigned roles. | `id` (UUID) | `roleId` -> Role |
| **`ProductCategory`** | Extensible product categories (Food, Beverage, Cosmetic, Household, etc.). | `id` (UUID) | None |
| **`Product`** | Physical product details being inspected across batches/locations. | `id` (UUID) | `categoryId` -> ProductCategory |
| **`Inspection`** | Central compliance evaluation record with `inspectedAt`, workflow & legal status. | `id` (UUID) | `productId` -> Product, `createdBy` -> User |
| **`InspectionImage`** | Metadata reference to packaging photographs (Front, Back, Side, etc.). | `id` (UUID) | `inspectionId` -> Inspection |
| **`OCRResult`** | Raw, immutable OCR text extraction output, confidence, and bounding boxes. | `id` (UUID) | `inspectionImageId` -> InspectionImage |
| **`Declaration`** | Extracted mandatory packaging attributes with `source` (OCR/AI/MANUAL) & nullable confidence. | `id` (UUID) | `inspectionId` -> Inspection, `sourceImageId` -> InspectionImage |
| **`Rule`** | High-level Legal Metrology rule definition (e.g. `LM-PC-MRP`). | `id` (UUID) | None |
| **`RuleVersion`** | Versioned legal rule requirement and validation criteria (preserves legal history). | `id` (UUID) | `ruleId` -> Rule |
| **`RuleVersionCategory`** | Join entity defining rule applicability per product category. | `id` (UUID) | `ruleVersionId` -> RuleVersion, `categoryId` -> ProductCategory |
| **`ValidationResult`** | Outcome of evaluating an inspection against a specific `RuleVersion`. | `id` (UUID) | `inspectionId` -> Inspection, `ruleVersionId` -> RuleVersion |
| **`Violation`** | Flagged compliance failure requiring resolution or human review. | `id` (UUID) | `inspectionId` -> Inspection, `validationResultId` -> ValidationResult |
| **`Evidence`** | Typed supporting evidence linking violations to images, OCR, or declarations. | `id` (UUID) | `violationId` -> Violation, `imageId`, `ocrResultId`, `declarationId` |
| **`Report`** | Generated PDF/summary compliance audit reports. | `id` (UUID) | `inspectionId` -> Inspection, `generatedBy` -> User |
| **`AuditLog`** | Comprehensive security and administrative action audit trail. | `id` (UUID) | `userId` -> User (nullable) |

---

## 3. Deletion Strategy & Integrity Protection

To protect legal compliance records from accidental or malicious data loss:
* **`onDelete: Restrict`**: Applied to `InspectionImage` -> `Inspection`, `OCRResult` -> `InspectionImage`, `Declaration` -> `Inspection`, `ValidationResult` -> `Inspection`, `Violation` -> `Inspection`, `Evidence` -> `Violation`, and `Report` -> `Inspection`. Prevents deleting completed compliance inspections and erasing historical evidence.
* **`onDelete: SetNull`**: Applied to `Evidence` -> `imageId` / `ocrResultId` / `declarationId`, `Declaration` -> `sourceImageId`, and `AuditLog` -> `userId` to maintain evidence log integrity.

---

## 4. Database Commands Reference

### Prisma Format & Validate
```bash
npx prisma format
npx prisma validate
```

### Prisma Client Generation
```bash
npm run prisma:generate
```

### Create & Apply Development Migration
```bash
npm run prisma:migrate
```

### Seed Initial Database Data
```bash
npm run prisma:seed
```

### Open Prisma Studio (GUI Database Viewer)
```bash
npm run prisma:studio
```
