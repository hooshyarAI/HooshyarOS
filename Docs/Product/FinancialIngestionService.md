# Financial Ingestion Service (Commercial Runtime Surface)

**Capability ID:** `product.financial-data-ingestion`
**Canonical owner:** `Backend/HBOS/Product/FinancialDataIngestionAdapter.ts`
**Runtime composition service:** `Backend/HBOS/Product/FinancialIngestionService.ts`
**Runtime surface:** `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
**Focused tests:** `Backend/HBOS/test/Phase14-IngestionRuntime.test.ts`

---

## Purpose

Expose the canonical multi-format financial ingestion to the commercial product
runtime. Before Phase 14 the only product ingestion path was `POST /api/analyze`
with CSV text. Phase 14 makes Excel, structured JSON and plain-text ingestion
available through the runtime and browser product flow, with tenant-scoped
raw-source evidence.

`FinancialIngestionService` is a **supporting composition service**, not a new
engine and not an alternate adapter. It never re-implements parsing, validation,
normalization or canonical-model persistence: all of those remain inside the
canonical `FinancialDataIngestionAdapter`.

---

## Supported formats

| Format (`format`) | Input field | Canonical route | Notes |
|-------------------|-------------|-----------------|-------|
| `CSV` | `content` (text) | `ingestCsv` | `date, account, debit, credit, currency` |
| `STRUCTURED` | `content` (JSON text) | `ingestStructured` | `{ transactions: [...] }` |
| `TXT` | `content` (text) | `ingestTxtBytes` | UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE |
| `XLSX` | `contentBase64` | `ingestXlsx` | `exceljs-hardened`, formula values only, zip-bomb limits |

### Deliberately NOT supported

- **PDF** — parsers (`PdfAcquisition` + `pdf-parse`) exist, but they are not a
  declared direct dependency of the canonical ingestion owner, scanned-only PDF
  cannot be handled (no OCR / `tesseract.js`), and the adapter contract still
  declares PDF **BLOCKED**. No PDF support is claimed.
- **DOCX / DOC** — same reasoning (`mammoth` helper exists but is not routed by
  the canonical owner).
- **XLS** — dependency-blocked legacy binary format.
- **Images** — require OCR; `ingestFile` returns `ingestion-image-requires-ocr`.

---

## Runtime API

### `POST /api/ingest`

Permission: `INGEST_DATA`. Rate limited. Body limit: 8 MB.

```json
{ "sourceName": "ledger.xlsx", "format": "XLSX", "contentBase64": "<base64>" }
{ "sourceName": "ledger.csv",  "format": "CSV",  "content": "date,account,..." }
{ "sourceName": "ledger.json", "format": "STRUCTURED", "content": "{\"transactions\":[...]}" }
```

Success `201`:

```json
{
  "status": "READY",
  "tenantId": "tenant:...",
  "format": "XLSX",
  "evidence": { "sourceName": "ledger.xlsx", "sourceType": "XLSX", "sha256": "...", "receivedAt": "..." },
  "source": { "persistenceKey": "raw-source:<sha256>", "sha256": "...", "byteLength": 6528, "persisted": true },
  "transactionCount": 2,
  "totals": { "debit": 1000, "credit": 1000, "balance": 0 }
}
```

### `GET /api/sources`

Permission: `READ_DASHBOARD`. Returns the caller's tenant-scoped raw sources.

### `GET /api/sources/:sha256`

Permission: `READ_DASHBOARD`. Returns the persisted raw evidence (content encoding
`utf8` or `base64`). Cross-tenant lookups return `404 SOURCE_NOT_FOUND`.

---

## Provenance and evidence model

```
Upload/Browser → POST /api/ingest → FinancialIngestionService
   → raw-source:<sha256> persisted (tenant-scoped, SQLitePersistenceStore)
   → FinancialDataIngestionAdapter (validate → normalize → canonical model)
   → financial-ingestion:<sha256> persisted (tenant-scoped)
   → downstream canonical financial intelligence
```

- `sha256` is computed from the **original bytes**.
- Identical raw content is naturally deduplicated by content hash.
- Raw evidence is strictly tenant-scoped; there is no cross-tenant read path.

---

## Error behaviour (fail closed)

Unsupported/ambiguous input is rejected before any model is persisted:

| Code | Meaning |
|------|---------|
| `INGEST_FORMAT_UNSUPPORTED` (400) | `format` is not CSV/STRUCTURED/XLSX/TXT |
| `CONTENT_REQUIRED` / `CONTENT_BASE64_REQUIRED` (400) | payload missing content |
| `SOURCE_NAME_REQUIRED` (400) | empty source name |
| `ingestion-*` (422) | canonical validation/normalization error (e.g. `ingestion-double-sided-row:2`, `ingestion-excel-parse-error`) |

---

## Architecture compliance

- One capability = one canonical owner (`FinancialDataIngestionAdapter`).
- No duplicate engine or alternate adapter.
- No external parser infrastructure invented.
- No test weakened; all prior adapter/runtime tests still pass.
