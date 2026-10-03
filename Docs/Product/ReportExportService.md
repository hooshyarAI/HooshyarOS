# ReportExportService

**Capability:** `product.reports-export`
**Owner:** `Backend/HBOS/Product/ReportExportService.ts`
**Target engine / canonical report owner:** `Backend/HBOS/Engines/ReportsEngine.ts`
**Composition boundary (no duplicate engine):** `ReportsEngine` renders the file; this service owns persistence, provenance and tenant-isolated retrieval only.

## Purpose

Turn the canonical report capability into a real, commercially usable export:
`ReportsEngine` serializes a validated report document into genuine file bytes,
and this service persists the bytes as a tenant-scoped artifact with canonical
provenance and serves it back as a secure download.

The capability does **not**:
- return report text as JSON and call it an export,
- rename a JSON payload into another format,
- create a second report engine or duplicate any report semantics,
- claim formats the repository cannot actually serialize.

## Supported formats (genuinely rendered)

| Format | Content type | Notes |
|--------|--------------|-------|
| `TXT` | `text/plain; charset=utf-8` | Human-readable report text |
| `CSV` | `text/csv; charset=utf-8` | `"Section","Entry"` rows |
| `JSON` | `application/json; charset=utf-8` | Structured document |
| `XLSX` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Real workbook via `exceljs-hardened` |

PDF and DOCX are intentionally **not** claimed: the repository owns readers for
those formats (`pdf-parse`, `mammoth`), not writers. Claiming them would be a
fake export.

## Contract

```ts
interface ReportExportInput {
  tenantId: string;                  // required; fail-closed
  title: string;
  sections: ReportSection[];         // heading + lines
  format: ReportFormat;              // TXT | CSV | JSON | XLSX
  generatedAt?: string;
  metadata?: Record<string, string>;
  sourceRef?: string;                // canonical source (e.g. financial-ingestion:<sha256>)
}

type ReportExportResult =
  | { status: "READY"; artifact: ReportArtifactMetadata; downloadPath: string }
  | { status: "BLOCKED"; reason: string };
```

`ReportArtifactMetadata` carries `artifactId` (opaque `report-<32 hex>`),
`tenantId`, `fileName`, `contentType`, `fileExtension`, `sha256`, `byteLength`,
`generatedAt` and the canonical `ProvenanceLink`.

## Persistence and integrity

- Artifact bytes are stored base64-encoded under the tenant-scoped key
  `report-artifact:<artifactId>` in the canonical `SQLitePersistenceStore`.
- A tenant-scoped index `report-artifacts:index` (newest first, capped) backs the
  artifact list.
- On retrieval the SHA-256 of the stored bytes is recomputed and compared with
  the recorded digest; a mismatch fails closed (`null` → runtime `404`).

## Security and tenant isolation

- Every read is performed inside the caller's tenant scope **and** re-checks the
  stored `tenantId`; a guessed artifact id from another tenant resolves to `null`.
- Artifact ids are opaque random values, not predictable sequence numbers.
- Authentication and RBAC are enforced at the runtime boundary before any
  persistence access (`READ_DASHBOARD`). Unauthenticated calls are denied `401`.

## Runtime

| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| POST | `/api/report/export` | `READ_DASHBOARD` | Builds sections from the tenant's persisted analysis, executive workbench and financial analytics; renders + persists the artifact. `400 REPORT_FORMAT_UNSUPPORTED`, `422 REPORT_ANALYSIS_REQUIRED`. |
| GET | `/api/report/artifacts` | `READ_DASHBOARD` | Tenant-scoped artifact metadata list. |
| GET | `/api/report/artifacts/:artifactId/download` | `READ_DASHBOARD` | Serves the real bytes with `Content-Type`, `Content-Disposition: attachment`, `Content-Length` and `X-Artifact-SHA256`. `404 REPORT_ARTIFACT_NOT_FOUND` cross-tenant or unknown. |

The existing JSON `/api/report` endpoint is unchanged and now shares the same
section-building function, so report content and exported content cannot drift.

## Truthful boundary

- Bytes are structurally real and re-readable (XLSX verified by ExcelJS).
- Provenance is the canonical `ProvenanceTrace` link — no parallel audit system.
- No artifact is served across tenants, and no artifact is served without
  authentication/authorization.
