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
- **EXCEL** — BLOCKED (pending dependency approval)
- **PDF** — BLOCKED (pending dependency approval)

---

## Architecture

```
File Source → CSV/JSON Ingestion → Validation → Canonical Normalization
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

---

## API

### `ingestFile(tenantId, sourcePath)`

Ingest a single file (auto-detects CSV vs JSON by extension).

### `ingestCsv(tenantId, sourceName, csvContent)`

Ingest CSV content directly.

### `ingestStructured(tenantId, sourceName, jsonContent)`

Ingest JSON/STRUCTURED content directly.

### `ingestBatch(tenantId, sourcePaths)`

Ingest multiple files in a single operation.

- Continues processing on individual file failure (fail-fast: false)
- Returns per-file success/failure summary
- All data remains tenant-scoped

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
- `sourceType` — "CSV" or "STRUCTURED"
- `sha256` — Content hash for deduplication
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
| `ingestion-header-and-data-required` | CSV has no data rows |
| `ingestion-schema-invalid` | CSV header doesn't match expected schema |
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
| `ingestion-batch-empty` | Batch operation with empty file list |

---

## Test Evidence

- 35 tests pass (including 5 batch ingestion tests)
- 24 FinancialStatementAnalysisService integration tests pass
- Tenant isolation verified
- Error handling verified
