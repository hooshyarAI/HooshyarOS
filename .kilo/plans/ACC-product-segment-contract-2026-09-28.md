# ACC ITEM — ADDITIVE PRODUCT / SEGMENT CANONICAL CONTRACT EXTENSION

Status: **RECORDED — ADDITIVE, BACKWARD-COMPATIBLE EXTENSION (no frozen contract broken)**
Date: 2026-09-28
Branch: `fix/autonomous-product-factory`
Base HEAD: `97ef603f`
Model: `deepseek/deepseek-flash`
Author: Kilo (bounded execution layer) — under the true-end-to-end product audit plan

## DEFECT (evidence-backed)
The real benchmark `123.xlsx` (46,252 bytes, sha256 `10d44d0f7ae7858d57f61e69aadfd9e32ccca10a4963d84ab34c620f736c5a5f`)
contains an operating-revenue-and-cost table (`درآمدهای عملیاتی و بهای تمام شده`) that reports, **per
product and per period**, quantity produced, quantity sold, unit price, sales amount, cost of goods sold and
gross profit. The product rows sum **exactly** to the company statement (revenue 32,129,418 M IRR; gross
profit 5,036,175 M IRR), so the data is canonical and internally consistent.

Before this change, the canonical document contract (`FinancialDocumentUnderstanding`) owned no
product/segment projection, so the pipeline discarded the table before analysis, and the narrative disclosed
product/segment profitability as "not modeled". Plan Phase 6 requires the missing canonical extraction
contract to be added (not inferred from company totals, no parallel engine).

## AFFECTED CONTRACT
- `Backend/HBOS/Product/FinancialDocumentUnderstanding.ts`
  - new optional `segments?: ReadonlyArray<ProductSegment>` on `FinancialDocumentUnderstanding`;
  - new `ProductSegment` / `ProductSegmentPeriodValue` types;
  - new `extractProductSegments` (internal) + `extractProductSegmentsFromBlocks` (exported) that scan for the
    per-product table by header signature only (exact metric labels; estimate periods excluded; current/prior
    mapped by the two most recent year headers or explicit current/prior labels).
- New composition service `Backend/HBOS/Product/ProductSegmentAnalysis.ts` — `analyzeProductSegments()`.
  It owns **no new statement mathematics**; it aggregates extracted per-product figures into contributions,
  margins, concentration (HHI) and a standard mix/rate-cost decomposition.
- `FinancialStatementInsight` gains an optional `productSegments` view + grounded findings/limitations.
- `FinancialDecisionNarrativeService` gains a `PRODUCT` intent and a product/segment answer; the previous
  unconditional "not modeled" disclosure now appears only when the document truly has no product table.
- `CommercialRuntimeServer` report gains a `سودآوری محصول/بخش` section when segments exist.

## BACKWARD COMPATIBILITY
- `segments` is optional; every existing document literal and consumer is unaffected.
- No existing measure, section type, ratio, engine, registry or persistence key changed.
- A document without the product table yields `productSegments === null` and keeps the honest data-gap
  disclosure. No value is ever inferred from company totals.

## ARCHITECTURAL IMPACT
Additive data projection + composition only. No new Engine, no parallel mathematics engine, no registry or
orchestration change, no Architecture Freeze V4/V4.1 mutation. The canonical owner of every financial figure
remains the extracted document fact; the analytics service only aggregates it.

## EVIDENCE / TESTS
- `Backend/HBOS/test/FinancialProductSegmentIntegration.test.ts` — extraction, contributions/margins/
  concentration/mix, negative-margin identification, honest absence, PRODUCT intent; real-file assertions
  (product totals equal company totals).
- `Backend/HBOS/test/RealProductLifecycleAcceptance.test.ts` — real HTTP lifecycle with the real file.
- Full regression rerun before commit.

## DECISION
Accepted as an additive, governed contract extension. No frozen boundary was modified; no further ACC
approval is required to keep this extension, but it is recorded here per the architecture-change rule.
