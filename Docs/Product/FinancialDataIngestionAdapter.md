# Financial Data Ingestion Adapter

**Capability ID:** `product.financial-data-ingestion`

**Implementation Path:** `Backend/HBOS/Product/FinancialDataIngestionAdapter.ts`

**Test Path:** `Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts`, `Backend/HBOS/test/IngestionDocumentNormalization.test.ts`

---

## Capability Contract

Canonical multi-format financial data ingestion with tenant isolation and persistence.

**OCR/document normalization boundary:** OCR-derived (and other extracted) document text is normalized through the canonical `DocumentTableExtractor` statement boundary before the strict CSV contract is considered. Realistic statement layouts (synonym headers such as `description`/`narration`, extra `balance`/`reference` columns, a declared document currency, multi-word descriptions, thousands-separated amounts) map to the canonical `date | account | debit | credit | currency` model. Ambiguity or unsafety fails closed with `ingestion-ambiguous-table-mapping` / `ingestion-table-schema-invalid`; the strict CSV parser is a fallback only for text that genuinely matches it.

**Unified financial document understanding:** a complete annual financial report (or a financial-statement workbook) is not a transaction ledger. When the ledger/statement transaction route cannot map a document, the SAME `Product/FinancialDocumentUnderstanding.ts` boundary used by PDF, XLSX and legacy XLS detects the report sections (auditor, board, balance sheet, income statement, cash flow, equity, notes) and normalizes statement tables into canonical facts, which are attached to the one canonical model as an optional `document` field. The 5-column transaction model remains canonical for real ledgers. See `Docs/Product/FinancialDocumentUnderstanding.md`.

**HTML disguised as a spreadsheet:** an Excel "Save as Web Page" export is frequently named `.xls` (or `.xlsx`) but contains HTML, not OLE2/BIFF or OOXML. Because the magic bytes are not a spreadsheet signature, the adapter sniffs the real content and routes it through the governed HTML path (`extractMarkupTables` + the same unified statement boundary), reporting `sourceType: "HTML"` and `contentKind: "html"` and preserving the ORIGINAL-byte SHA-256. It is never reported as a successfully parsed genuine XLS/XLSX workbook. Empty/malformed HTML, or HTML with no valid financial table, fails closed with `spreadsheet-html-content-unsupported` (`spreadsheet-html-content-detected` is the detection code). The `xls-reader` provider is not "broken" for genuine OLE2/BIFF workbooks and is unchanged.

**Supported Formats:**
- **CSV** — Standard CSV with columns: date, account, debit, credit, currency
- **STRUCTURED (JSON)** — JSON with `transactions` array containing financial transactions
- **TXT** — decoded UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE text, normalized through the canonical ledger pipeline
- **XLSX** — Microsoft Excel 2007+ format (.xlsx files) ✅ SUPPORTED
- **PDF (text-native)** — `.pdf` files with an extractable text layer, via the existing `pdf-parse`-backed `PdfAcquisition` helper (`ingestPdfBytes`); extracted text is normalized through the same canonical ledger (CSV) pipeline. Scanned/image-only PDF is supported through the governed OCR route (`ingestScannedPdfBytes` with the admitted offline `tesseract.js` provider), and fails closed precisely when OCR is unavailable or yields no text.
- **XLS** — Microsoft Excel 97-2003 format (.xls files) — **SUPPORTED** via the governed `xls-reader` provider (`document.xls.parse`); magic-byte validated, size-bounded, offline, values-only (no macro/formula execution)

---

## Architecture

```
File Source → CSV/JSON/XLSX/XLS/TXT/PDF Ingestion → Validation → Canonical Normalization
    → Tenant-Scoped Persistence → Financial Canonical Model (+ optional document understanding)
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

### PDF Format (text-native, `ingestPdfBytes`)

**Dependency:** `pdf-parse@2.4.5` via the existing `PdfAcquisition` helper (no
second parser is introduced).

**Schema:** The extracted text must match the canonical ledger schema
(`date,account,debit,credit,currency`), exactly like CSV/TXT.

**Behaviour:**
- `%PDF` magic signature and `.pdf` extension are validated.
- Text is extracted deterministically from the original bytes.
- The canonical model's `source.sha256` is the SHA-256 of the **original PDF
  bytes**, preserving provenance; raw original bytes are persisted as
  tenant-scoped evidence by `FinancialIngestionService`.
- Extraction is rejected when the page count is zero or the average extracted
  characters per page is below the conservative scanned threshold.

**Failure behaviour (fail closed, truthful):**
- `ingestion-pdf-scanned-no-ocr-yet` — scanned/image-only/unextractable PDF
  reaching `ingestPdfBytes` (the text-native route). The runtime composition
  service routes such a document to the admitted OCR route
  (`ingestScannedPdfBytes`) instead of failing; no OCR success is ever faked.
- `ingestion-pdf-unsupported` — bytes lack a valid `%PDF` signature.
- `ingestion-pdf-empty` / `ingestion-pdf-corrupt` / `ingestion-pdf-password-protected`.
- `ingestion-format-mismatch` — extension does not match a PDF payload.

---

## API

### `ingestFile(tenantId, sourcePath)`

Ingest a single file (auto-detects CSV, JSON, TXT, PDF, or XLSX by extension and magic bytes).

### `ingestCsv(tenantId, sourceName, csvContent)`

Ingest CSV content directly.

### `ingestStructured(tenantId, sourceName, jsonContent)`

Ingest JSON/STRUCTURED content directly.

### `ingestTxtBytes(tenantId, sourceName, rawBytes)`

Decode text bytes (UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE) and ingest
through the canonical ledger pipeline.

### `ingestPdfBytes(tenantId, sourceName, rawBytes)`

Extract text from a text-native PDF via the `PdfAcquisition` helper and ingest
through the canonical ledger pipeline. Preserves the original PDF-byte SHA-256
as the model's `source.sha256`; scanned/image-only PDF fails closed with
`ingestion-pdf-scanned-no-ocr-yet` (the runtime composition service routes
scanned PDFs to `ingestScannedPdfBytes` instead).

### `ingestScannedPdfBytes(tenantId, sourceName, rawBytes, route)`

OCR route for scanned/image-only PDFs: `PdfPageRasterizer` renders the pages,
`ScannedPdfRouter` decides per page, and the caller-supplied `OcrAdapter`
recognizes them. OCR text is normalized through the SAME canonical ledger
pipeline, the model's `source.sha256` stays the ORIGINAL PDF-byte hash, and
`source.ocr` records engine identity/version, measured mean confidence and
language. Fails closed when OCR yields no text (`ingestion-ocr-empty`).

### `ingestBatch(tenantId, sourcePaths)`

Ingest multiple files in a single operation.

- Continues processing on individual file failure (fail-fast: false)
- Returns per-file success/failure summary
- All data remains tenant-scoped
- Supports mixed formats: CSV, JSON, TXT, PDF, XLSX

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
- `sourceType` — "CSV", "STRUCTURED", "XLSX", "PDF" (and other routes as added)
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
| 08-D.2 | ✅ COMPLETE | XLS acquisition via the admitted `xls-reader` provider (OLE2/BIFF8), converging on the unified document/statement boundary |

---

## Test Evidence

- 37 tests pass (including XLSX and batch ingestion tests)
- XLSX format detection tests pass
- XLSX schema validation tests pass
- XLSX resource limit tests pass
- Tenant isolation verified for XLSX
- Batch mixed-format (CSV + JSON + XLSX) tests pass
- Backward compatibility with CSV/JSON ingestion verified
