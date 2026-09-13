# Financial Data Ingestion Adapter

**Capability ID:** `product.financial-data-ingestion`

**Implementation Path:** `Backend/HBOS/Product/FinancialDataIngestionAdapter.ts`

**Test Path:** `Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts`

---

## Capability Contract

Canonical multi-format financial data ingestion with tenant isolation and persistence.

**Supported Formats:**
- **CSV** — Standard CSV with columns: date, account, debit, credit, currency
- **STRUCTURED (JSON)** — JSON with `transactions` array containing financial transactions
- **XLSX** — Microsoft Excel 2007+ format (.xlsx files) ✅ SUPPORTED
- **XLS** — Microsoft Excel 97-2003 format (.xls files) — **BLOCKED** (pending dependency resolution)
- **PDF** — BLOCKED (pending dependency approval)

---

## Architecture

```
File Source → CSV/JSON/XLSX Ingestion → Validation → Canonical Normalization
    → Tenant-Scoped Persistence → Financial Canonical Model
```

---

## Supported Formats

### CSV Format

**Schema:** `date,account,debit,credit,currency`

**Validation Rules:**
- Date must be YYYY-MM-DD format
- Account name must be non-empty
- Currency must be non-empty
- Debit OR credit must be positive (not both)
- Zero-value transactions rejected

### JSON/STRUCTURED Format

**Schema:**
```json
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "account": "string",
      "debit": number,
      "credit": number,
      "currency": "string"
    }
  ]
}
```

**Validation Rules:**
- Same as CSV plus:
- JSON must be parseable
- `transactions` array must exist and be an array

### XLSX Format (Supported in Stage 08-D.1)

**Dependency:** `exceljs-hardened@5.0.0`

**Schema:** Same as CSV — columns: date, account, debit, credit, currency

**Security Controls:**
- Magic byte format detection (XLSX: `50 4B 03 04` ZIP signature)
- Extension/signature mismatch rejection
- Decompression bomb protection via exceljs-hardened
  - Max zip entry uncompressed size: 128 MB (configurable)
  - Max total uncompressed size: 512 MB (configurable)
- No formula evaluation — only cached cell values are read
- No macro execution
- No arbitrary file access

**Excel Date Handling:**
- Excel serial dates (days since 1900-01-01) are correctly converted to ISO format
- Leap year bug correction applied (Excel incorrectly assumes Feb 29, 1900 exists)
- UTC-based conversion to avoid timezone-induced date shifts

**Resource Policy (Configurable — INITIAL POLICY VALUES, NOT scientifically verified):**
| Policy | Default | Classification |
|--------|---------|----------------|
| XLSX max file size | 5 MB | Initial policy |
| XLSX zip entry limit | 128 MB | Initial policy |
| XLSX total uncompressed limit | 512 MB | Initial policy |
| XLS parse budget | 60 s | Initial policy |
| XLS max file size | 10 MB | Initial policy |

**Unsupported Cases:**
- Password-protected workbooks
- Macro-enabled workbooks (.xlsm)
- External workbook references
- Linked data types
- Pivot tables
- Charts and drawings

---

## API

### `ingestFile(tenantId, sourcePath)`

Ingest a single file (auto-detects CSV, JSON, or XLSX by extension and magic bytes).

### `ingestCsv(tenantId, sourceName, csvContent)`

Ingest CSV content directly.

### `ingestStructured(tenantId, sourceName, jsonContent)`

Ingest JSON/STRUCTURED content directly.

### `ingestBatch(tenantId, sourcePaths)`

Ingest multiple files in a single operation.

- Continues processing on individual file failure (fail-fast: false)
- Returns per-file success/failure summary
- All data remains tenant-scoped
- Supports mixed formats: CSV, JSON, XLSX

**Returns:**
```typescript
{
  tenantId: string;
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  results: Array<{
    sourcePath: string;
    success: boolean;
    evidence?: FinancialSourceEvidence;
    error?: string;
  }>;
}
```

---

## Data Model

### `FinancialTransaction`

```typescript
interface FinancialTransaction {
  readonly date: string;        // YYYY-MM-DD
  readonly account: string;
  readonly debit: number;
  readonly credit: number;
  readonly currency: string;
}
```

### `FinancialCanonicalModel`

```typescript
interface FinancialCanonicalModel {
  readonly tenantId: string;
  readonly source: FinancialSourceEvidence;
  readonly transactions: readonly FinancialTransaction[];
  readonly totals: {
    readonly debit: number;
    readonly credit: number;
    readonly balance: number;
  };
}
```

---

## Provenance

Every ingestion includes source evidence:
- `sourceName` — Original filename
- `sourceType` — "CSV", "STRUCTURED", or "XLSX"
- `sha256` — SHA-256 hash computed from **original raw bytes** (before any parsing)
- `receivedAt` — ISO 8601 timestamp

---

## Tenant Isolation

All data is persisted under tenant scope. Cross-tenant access is rejected.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `ingestion-source-path-required` | Empty source path |
| `ingestion-tenant-required` | Empty tenant ID |
| `ingestion-source-required` | Empty source name |
| `ingestion-source-empty` | Empty file content |
| `ingestion-file-too-large` | File exceeds configured size limit |
| `ingestion-format-unsupported` | Unknown binary format |
| `ingestion-format-mismatch` | Extension/signature mismatch |
| `ingestion-header-and-data-required` | CSV has no data rows |
| `ingestion-schema-invalid` | Header doesn't match expected schema |
| `ingestion-row-invalid:N` | Row N has wrong column count |
| `ingestion-date-invalid:N` | Row N has invalid date format |
| `ingestion-account-invalid:N` | Row N has empty account |
| `ingestion-currency-invalid:N` | Row N has empty currency |
| `ingestion-amount-invalid:field:N` | Row N has invalid amount |
| `ingestion-zero-row:N` | Row N has zero debit and credit |
| `ingestion-double-sided-row:N` | Row N has both debit and credit |
| `ingestion-json-parse-error` | JSON cannot be parsed |
| `ingestion-structured-schema-invalid` | JSON doesn't have transactions array |
| `ingestion-structured-txn-invalid:N` | Transaction N is not an object |
| `ingestion-excel-parse-error` | XLSX cannot be parsed (corrupted/invalid) |
| `ingestion-empty-workbook` | XLSX has no data rows |
| `ingestion-parse-timeout` | XLSX parse exceeded time budget |
| `ingestion-batch-empty` | Batch operation with empty file list |

---

## Stage 08-D Sub-Stages

| Sub-Stage | Status | Notes |
|-----------|--------|-------|
| 08-D.1 | ✅ COMPLETE | XLSX acquisition via exceljs-hardened |
| 08-D.2 | ⏳ PENDING | XLS acquisition (BLOCKED - xlsx@0.20.3 unavailable) |

---

## Test Evidence

- 37 tests pass (including XLSX and batch ingestion tests)
- XLSX format detection tests pass
- XLSX schema validation tests pass
- XLSX resource limit tests pass
- Tenant isolation verified for XLSX
- Batch mixed-format (CSV + JSON + XLSX) tests pass
- Backward compatibility with CSV/JSON ingestion verified
