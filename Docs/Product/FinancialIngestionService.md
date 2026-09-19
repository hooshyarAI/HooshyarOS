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
| `TSV` | `content` (text) | `ingestTsv` | Tab-delimited ledger; same canonical pipeline as CSV |
| `HTML` | `content` (text) | `ingestHtml` | Real table extraction first, then bounded visible text; `<script>`/`<style>` never executed |
| `XML` | `content` (text) | `ingestXml` | Repeating `<transaction>` element contract first, then bounded visible text; `<!DOCTYPE>`/`<!ENTITY>` rejected (XXE defense) |
| `DOCX` | `contentBase64` | `ingestDocxBytes` | `mammoth` text + table extraction; legacy `.doc` rejected explicitly |
| `XLSX` | `contentBase64` | `ingestXlsx` | `exceljs-hardened`, formula values only, zip-bomb limits |
| `PDF` (text-native) | `contentBase64` | `ingestPdfBytes` | `pdf-parse` via `acquirePdf`; extracted text normalized through the canonical ledger (CSV) pipeline; original-byte SHA-256 provenance |

All formats converge on the **one** canonical owner
(`FinancialDataIngestionAdapter`) and the **one** validation/normalization/
persistence/provenance pipeline. No format-specific intelligence engine and no
second adapter exists.

### Deliberately NOT supported

- **PDF (scanned/image-only)** — text-native PDF is supported. A PDF whose
  average extracted characters per page is below the conservative threshold is
  rejected with the precise error `ingestion-pdf-scanned-no-ocr-yet` (422). The
  governed OCR route (`FinancialDataIngestionAdapter.ingestScannedPdfBytes` +
  `ScannedPdfRouter` + the admitted `pdf-parse` page rasterizer) exists and is
  focused-tested through an **injected** OCR adapter, but no OCR **engine**
  provider is admitted yet, so the commercial runtime never performs OCR and
  never fakes it. OCR is recorded as `DEFERRED` in the canonical
  capability-provider inventory (`CapabilityProviderRegistry`) with explicit
  unmet admission conditions; see `Docs/HOOSHYAROS_CAPABILITY_PROVIDER_LEVERAGE_LAW.md`.
- **DOC** (legacy binary Word) — rejected explicitly with
  `ingestion-doc-not-supported`; customers convert to DOCX. LibreOffice headless
  conversion is evaluated and `DEFERRED` (deployment/security footprint).
- **RTF / ODT / PPTX / EPUB / EML / MSG / DBF / YAML / TIFF** — evaluated and
  recorded as `DEFERRED` with unmet conditions; none is claimed as supported.
- **XLS** — dependency-blocked legacy binary format; no hardened reader admitted.
- **Broader document fallback (Apache Tika)** — evaluated and `DEFERRED`: the
  JVM runtime/deployment/security footprint is not justified while the direct
  providers cover the primary commercial input families.
- **Images via the runtime** — not exposed as an `IngestionFormat` until OCR is
  admitted; `ingestFile` returns `ingestion-image-requires-ocr`.
  `FinancialDataIngestionAdapter.ingestImageBytes` is the governed boundary and
  fails closed with `ingestion-ocr-unsupported` when no engine is available.

---

## Runtime API

### `POST /api/ingest`

Permission: `INGEST_DATA`. Rate limited. Body limit: 8 MB.

```json
{ "sourceName": "ledger.xlsx", "format": "XLSX", "contentBase64": "<base64>" }
{ "sourceName": "ledger.csv",  "format": "CSV",  "content": "date,account,..." }
{ "sourceName": "ledger.json", "format": "STRUCTURED", "content": "{\"transactions\":[...]}" }
{ "sourceName": "ledger.pdf",  "format": "PDF",  "contentBase64": "<base64 text-native PDF>" }
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

### `POST /api/financial/analyze`

Permission: `INGEST_DATA`. Consumes an already-ingested canonical model
(identified by `sourceSha256` = the canonical `evidence.sha256` returned by
`POST /api/ingest`) and runs the canonical `FinancialStatementAnalysisService` /
`FinancialIntelligenceEngine`. This is the integration path that carries
multi-format ingestion into canonical financial intelligence.

```json
{ "sourceSha256": "<64-hex>", "assets": 4000, "liabilities": 1000 }
```

- `400 SOURCE_SHA256_REQUIRED` / `BALANCE_SHEET_FIELDS_REQUIRED` — bad input.
- `422 INGESTED_SOURCE_REQUIRED` — no such ingested source **for this tenant**.
- The persisted analysis is then observable through `/api/dashboard`,
  `/api/report`, `/api/executive/workbench` and `/api/assistant`.

---

## Provenance and evidence model

```
Upload/Browser → POST /api/ingest → FinancialIngestionService
   → raw-source:<sha256> persisted (tenant-scoped, SQLitePersistenceStore)
   → FinancialDataIngestionAdapter (validate → normalize → canonical model)
   → financial-ingestion:<sha256> persisted (tenant-scoped)
   → downstream canonical financial intelligence
```

- `sha256` is computed from the **original bytes**. For text-native PDF, DOCX,
  HTML, XML and TSV the extracted text/tables are normalized through the same
  canonical ledger pipeline, but the canonical model's `source.sha256` remains
  the original source-byte (or original source-text) SHA-256. OCR-derived text
  (when an admitted engine is supplied programmatically) additionally records
  `evidence.ocr` with engine identity/version, confidence and language, so
  OCR-derived evidence is always distinguishable from native text.
- Identical raw content is naturally deduplicated by content hash.
- Raw evidence is strictly tenant-scoped; there is no cross-tenant read path.

---

## Error behaviour (fail closed)

Unsupported/ambiguous input is rejected before any model is persisted:

| Code | Meaning |
|------|---------|
| `INGEST_FORMAT_UNSUPPORTED` (400) | `format` is not CSV/STRUCTURED/XLSX/TXT/TSV/HTML/XML/DOCX/PDF |
| `CONTENT_REQUIRED` / `CONTENT_BASE64_REQUIRED` (400) | payload missing content (XLSX/PDF/DOCX require `contentBase64`) |
| `SOURCE_NAME_REQUIRED` (400) | empty source name |
| `ingestion-pdf-scanned-no-ocr-yet` (422) | scanned/image-only/unextractable PDF — text-native PDF required, no OCR is performed |
| `ingestion-pdf-unsupported` (422) | bytes lack a valid `%PDF` signature |
| `ingestion-pdf-empty` / `ingestion-pdf-corrupt` / `ingestion-pdf-password-protected` (422) | empty, malformed or password-protected PDF |
| `ingestion-*` (422) | canonical validation/normalization error (e.g. `ingestion-double-sided-row:2`, `ingestion-excel-parse-error`) |

---

## Architecture compliance

- One capability = one canonical owner (`FinancialDataIngestionAdapter`).
- No duplicate engine or alternate adapter.
- External providers (`pdf-parse` for text extraction and page rasterization,
  `exceljs-hardened`, `mammoth`) are admitted through the canonical
  `CapabilityProviderRegistry`; a format whose external provider is not admitted
  fails closed with `ingestion-provider-not-admitted`
  (`Docs/HOOSHYAROS_CAPABILITY_PROVIDER_LEVERAGE_LAW.md`). Internal-capability
  formats (CSV/STRUCTURED/TXT/TSV/HTML/XML) are implemented by the canonical
  owner with Node built-ins and are not gated by an external provider.
- No external parser infrastructure invented; no duplicate registry, adapter or
  ingestion architecture.
- No test weakened; all prior adapter/runtime tests still pass.
