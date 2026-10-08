# STAGE 1 — TRUSTED-INPUT-PIPELINE AUDIT & REMEDIATION QUEUE (CHECKPOINT PLAN)

Repository: `D:\HooshyarOS`
Branch: `fix/autonomous-product-factory`
Model: `deepseek/deepseek-flash` (DeepSeek V4.1 Flash only; no Pro model)
Operator: Kilo (bounded execution layer)
Date: 2026-09-27

## CHECKPOINT
- AUDIT HEAD (start): `90b90959`
- Focused commits made before this stage:
  - `b0f9074e` — Stage 2 epistemic trust labels on client-supplied analytics endpoints
  - `b9a483ff` — Stage 8 Android productization preservation
  - `396d9e90` — Stage 0/6 governance documentation (ACC duplicate EngineRegistry)
- SCOPE: read-only audit of all input paths + prioritized remediation queue. No source/runtime/test change.
- BASELINE: 28 suites / 347 tests passed before the audit.
- EVIDENCE: `.kilo/evidence/deepseek-flash-stage-1-input-path-audit-2026-09-27.txt`

## WHAT ALREADY EXISTS (verified, not redone)
- Canonical ingestion owner `FinancialDataIngestionAdapter.ts` (protected) + runtime composer
  `FinancialIngestionService.ts`; formats CSV, STRUCTURED, XLSX, XLS, TXT, TSV, HTML, XML, DOCX, PDF,
  and IMAGE/OCR.
- Identification: `FormatDetection.ts` magic/extension/content + `contentKind:"html"` override.
- Validation: structure/schema/types/required fields/amounts/signs/zero-row/double-sided on every
  ledger route; resource + CWE-409 zip-bomb limits; encrypted XLS rejection; scanned-PDF no-OCR
  limitation preserved (never faked).
- Provenance: `FinancialSourceEvidence` (sha256/receivedAt/sourceType/ocr), `RawSourceRef`/`FileSource`,
  `ProvenanceTrace`, `OcrProvenance`, tenant-scoped `raw-source:<sha256>` persistence.
- Canonicalization: `DocumentTableExtractor` (canonical schema, Persian normalization, digit
  conversion, unit detection) + `FinancialDocumentUnderstanding`.
- Reconciliation: `FinancialStatementInsight` accounting identities (balance sheet, gross profit,
  operating profit, cash-flow) with `RECONCILED|MISMATCH|NOT_TESTABLE` + `missing` evidence; ratio
  sanity; readiness gate refusing partial statements.
- Provider leverage: `CapabilityProviderRegistry` admission + `FinancialIngestionProviderGovernance`
  + `ConnectorRegistry` lifecycle. Fail-closed error codes across all routes.

## PRIORITIZED REMEDIATION QUEUE
Legend: DONE · PARTIAL · NOT_STARTED · BLOCKED · REQUIRES_ARCHITECTURE_CHANGE_CONTROL (ACC)

| ID | Item | Existing | Missing | Required change | Architectural impact | Tests required | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1-1 | Unified input trust-state contract (RECEIVED→IDENTIFIED→VALIDATED→CROSS-CHECKED→RECONCILED→TRUSTED/QUARANTINED/REJECTED) | Accept-vs-throw only; Stage 2 `inputTrust` on analytics endpoints | Any persisted/returned trust state on ingestion result/evidence | Additive trust assessment produced from existing evidence | Touches canonical ingestion contract → ACC | New focused suite + regression of ingestion suites | REQUIRES_ARCHITECTURE_CHANGE_CONTROL |
| S1-2 | Persistent QUARANTINED state | Fail-closed rejection only | Quarantine state distinct from reject | Add quarantine state alongside S1-1 | Canonical model → ACC | Focused + ingestion regression | REQUIRES_ARCHITECTURE_CHANGE_CONTROL |
| S1-3 | Cross-source contradiction / cross-source agreement check | Single-document accounting identities | Any comparison across two ingested sources | New reconciliation capability | New capability, touches reconciliation boundary → ACC | Adversarial contradictory-source tests | NOT_STARTED (ACC) |
| S1-4 | Prior-period consistency across separate ingested sources | Second period within one document only | Cross-source prior-period consistency | Extend reconciliation across sources | ACC | Focused + regression | NOT_STARTED (ACC) |
| S1-5 | Duplicate-transaction detection within a source | File-level sha256 dedup; in-memory forecasting dedup | Intra-source duplicate row detection | Add duplicate detection in canonical adapter | Protected `FinancialDataIngestionAdapter.ts` → ACC | New negative tests | REQUIRES_ARCHITECTURE_CHANGE_CONTROL |
| S1-6 | Chronology / period-consistency validation | ISO date format; document-detected `periodIndex`; future/duplicate/monotonic period not enforced | Future-date, duplicate-period, monotonic-period checks | Add period consistency checks | Adapter/understanding boundary → ACC if in adapter | Adversarial date/period tests | PARTIAL |
| S1-7 | Manual/client-supplied metrics canonical binding | Stage 2 labels `UNVERIFIED_INFORMATION`/`CLIENT_SUPPLIED`/`canonicalBinding:false` | Any canonical verification path for manual numbers | Requires a canonical trusted source to bind to | New capability → ACC | Focused + endpoint tests | PARTIAL |
| S1-8 | API/DB provider runtime integration + canonical-domain schema validation | Transport/secret/rate/read-only-query controls; contract tests only | Runtime wiring; canonical transaction schema validation of mapped rows | Wire connectors through canonical ingestion | Runtime/architecture → ACC | Contract + integration tests | PARTIAL |
| S1-9 | AcquisitionResourcePolicy stale rationale ("XLS not yet supported") | XLS implemented + tested | Correct rationale text | One-line documentation correction in `AcquisitionResourcePolicy.ts` | None (docs-only) | AcquisitionResourcePolicy.test.ts unchanged | NOT_STARTED (low priority, docs-only) |
| S1-10 | Current-standard online verification for accounting/engineering controls | In-repo authority records for providers | Authoritative online confirmation | Needs environment access | None | Evidence record | BLOCKED (no authoritative online source) |

## SMALLEST SAFE IMPLEMENTATION (next item, not done this run)
`S1-1 (partial step)` — add a NEW additive supporting service that consumes an already-produced
`FinancialIngestionResult` + integration-check output and returns an explicit trust assessment,
**without modifying the protected `FinancialDataIngestionAdapter.ts`** and without changing any
canonical calculation or schema. Own focused test + commit. Any injection of the trust field into
the frozen canonical model remains ACC.

## RECOMMENDED NEXT REMEDIATION ITEM
**S1-9** (safe, non-architectural, isolated, verifiable) as an immediately doable tiny correction,
followed by the S1-1 additive supporting-service step under review; S1-2..S1-8 remain ACC-gated.

## DECLARATIONS
- No completed work was repeated; PDF/XLSX ingestion, Persian-first UI, canonical financial
  calculations and Android provisioning were audited read-only.
- No Stage-1 remediation was implemented in this run.
- Nothing is declared DONE without passing tests as evidence.
