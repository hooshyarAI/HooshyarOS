# Financial Document Understanding (unified normalization boundary)

**Owner module:** `Backend/HBOS/Product/FinancialDocumentUnderstanding.ts`
**Kind:** supporting Product-level normalization boundary (NOT an Engine, NOT a second ingestion path, NOT a second canonical model)
**Consumers:** `Product/FinancialDataIngestionAdapter`, `Product/FinancialIngestionService`, `Product/IngestionJobService`, `Autonomous/Runtime/CommercialRuntimeServer`

## Why it exists

The canonical 5-column transaction model (`date, account, debit, credit, currency`) is correct for a real ledger. A complete annual financial report is **not** a ledger: it is a set of sections (independent auditor report, board report, statement of financial position, statement of profit or loss, statement of cash flows, statement of changes in equity, notes) whose statements are label + comparative-period columns. Forcing such a document through the ledger contract produced a generic `ingestion-schema-invalid` after a long OCR run.

This boundary gives PDF (native + OCR), XLSX and legacy XLS **one** place to detect sections and normalize statement tables into canonical financial facts.

## Source-to-facts flow

```text
source bytes
  -> acquisition / provider (pdf-parse, tesseract.js, exceljs-hardened, xls-reader)
  -> document/workbook structure detection (pages, worksheets)
  -> section detection            (FinancialSectionType)
  -> statement-table normalization (label + period columns)
  -> canonical StatementFacts     (measure, period, unit, currency, confidence, evidence)
  -> attached to the ONE FinancialCanonicalModel as optional `document`
  -> existing analysis / analytics owners
```

## Sections

`AUDITOR_REPORT`, `BOARD_REPORT`, `BALANCE_SHEET`, `INCOME_STATEMENT`, `CASH_FLOW_STATEMENT`, `CHANGES_IN_EQUITY`, `NOTES`, `UNKNOWN`.

Each section carries `state` (`COMPLETED` / `PARTIAL` / `FAILED`), its line range, its page range when the source is paged, its facts, precise notes and an optional failure code. Narrative sections are `COMPLETED` from real content and never fail the report merely for not being tables.

## Measures

`ASSETS`, `CURRENT_ASSETS`, `NON_CURRENT_ASSETS`, `LIABILITIES`, `CURRENT_LIABILITIES`, `NON_CURRENT_LIABILITIES`, `EQUITY`, `REVENUE`, `COGS`, `GROSS_PROFIT`, `OPERATING_EXPENSES`, `OPERATING_PROFIT`, `EXPENSES`, `NET_PROFIT`, `OPERATING_CASH_FLOW`, `INVESTING_CASH_FLOW`, `FINANCING_CASH_FLOW`, `NET_CASH_FLOW`.

## Normalization support

- Persian labels and English aliases; zero-width-joiner-insensitive, punctuation-insensitive matching.
- Persian / Arabic-Indic digits, thousands separators, parenthesised negatives and leading minus.
- Declared units: ریال, هزار ریال, میلیون ریال, میلیارد ریال, تومان (IRR/IRT), plus English "million IRR".
- Comparative / multiple periods from a positioned spreadsheet header or, for freeform OCR text, from the trailing numeric value run.
- Extra balance / reference / note columns are tolerated by position and never mistaken for a canonical field.
- OCR single-space layouts, multi-line descriptions and ragged rows.

**Never guesses.** An unrecognized label yields no fact; an ambiguous statement header fails closed with a precise code (`financial-report-ambiguous-table`, `ingestion-table-schema-invalid`, `ingestion-ambiguous-table-mapping`) instead of fabricating a mapping.

## Derived views for the existing analysis owners

- `deriveAnalysisInput(document)` -> `{ revenue, expenses, assets, liabilities, equity, statement, missingMeasures }`. Only extracted measures are used; `missingMeasures` names what was absent so a caller can fail closed honestly.
- `isCompleteRatioStatement(partial)` -> true only when every field the ratio analytics requires was actually derived, so a partial statement stays `BLOCKED` rather than being padded with zeros.
- `summarizeFinancialDocument(document)` -> the compact projection carried in job/API responses.

## Failure codes (user-facing primary message stays Persian)

| Code | Meaning |
|---|---|
| `financial-report-partial-success` | some sections extracted, others need review |
| `financial-report-ambiguous-table` | a statement table could not be mapped safely |
| `financial-report-insufficient-evidence` | no usable statement evidence |
| `spreadsheet-statement-ambiguous` | worksheet is not deterministically a statement or a ledger |
| `xls-provider-unavailable` | the governed XLS provider is not admitted |
| `xls-malformed` | malformed / truncated OLE2 workbook |
| `xls-encrypted-unsupported` | encrypted workbook (not supported by the provider) |

## Provenance

Every fact retains its source label, raw line text, line index and page index (when paged). The canonical model keeps the ORIGINAL-byte SHA-256 and, for OCR routes, the OCR engine/version/confidence/language. `FinancialDocumentUnderstanding` itself never performs acquisition, persistence, tenancy or security decisions — those remain with the canonical owners.
