# HOOSHYAROS — PRODUCT INTELLIGENCE QUALITY REPAIR REPORT

Date: 2026-09-27
Branch: `fix/autonomous-product-factory`
Operator: Kilo (bounded execution layer) — model `deepseek/deepseek-flash`
Baseline HEAD at start: `ddb53e2fc3278f760e948b394bc5aa4bb1904724`
Repair commit: `f8e5bc25`
Evidence: `.kilo/evidence/product-intelligence-quality-repair-2026-09-27.txt`

## 1. Mission and scope

Repair the actual product-intelligence / decision-support behaviour of the
installed HooshyarOS from the current repository state:

`SOURCE → NUMBERS → GENERIC SUMMARY` → `USER INTENT → CONTEXT/EVIDENCE → CORRECT
ENGINE/SERVICE ROUTING → CANONICAL CALCULATION → VALIDATION → REASONING →
INTERPRETATION → OPTIONS/SCENARIOS → DECISION CRITERIA → ACTIONS → EVIDENCE +
LIMITATIONS`.

No installer/productization work was touched. No completed ingestion, trust,
validation, Persian presentation, offline, Windows or Android work was redone.

## 2. Root causes

| # | Observed failure | Root cause |
|---|------------------|-----------|
| 1,7,8,14 | Question gets one generic metric bundle | `/api/assistant` fed a single mixed context string to `ReasoningEngine.reasonNative()`, which echoes `Revenue=/Profit=/DebtRatio=` for every question. No intent routing. |
| 2–6 | Empty/near-empty strengths/weaknesses/risks/opportunities/actions | `buildReportSections()` re-derived shallow findings with narrower conditions than the governed `FinancialStatementInsight` findings that already existed; the deeper findings were never consumed. |
| 9 | `32,129,418,000,000` vs `32,129,400,000,000` | Report used scaled/rounded amounts, and the client re-ran the answer through `localizeFinancialText`, whose numeric regex re-parsed scientific notation (`3.21294e+13` → `32,129,400,000,000`). |
| 10 | Ratio presented as a risk | No risk rationale; the debt ratio itself was labelled a risk. |
| 11 | `۰ تراکنش ... READY` implies transaction analysis | `finishIngestJob` always printed "تحلیل موفق … N تراکنش" and the raw `READY` token. |
| 12,13 | `preTaxIncome`, `taxes`, `balance-sheet-identity`, `Financial analytics:`, derived residual as accounting output | Internal identifiers emitted into the reasoning context/answer; report emitted an internal label. |
| 15 | "تحلیل جامع" with empty sections | Same as 2–6. |
| 16 | Advanced engines bypassed | Assistant bypassed the governed insight/decision composition. |

## 3. Affected user journeys

- Chat/assistant: risk question, three-scenario question, why-profit-changed,
  data-gap question, general analysis question.
- Financial statement insight surface (strengths/weaknesses/risks/opportunities/
  actions).
- Report generation (`/api/report`) and the JSON report section structure.
- Ingestion completion message (transaction vs statement scope).
- Organizational execution workspace cards.

## 4. Architecture compliance

- No new engine. The new `FinancialDecisionNarrativeService` is a
  **composition-only** product service (like `FinancialStatementInsight`,
  `FinancialAnalyticsService`, `OrchestratedDecisionIntelligenceService`). It
  owns no financial mathematics and never overrides canonical calculations.
- It consumes the governed `FinancialStatementInsight` (canonical facts + the
  existing `FinancialAnalyticsService` ratios). No frozen model, schema, tenant
  boundary, security contract or Architecture Freeze V4/V4.1 element changed.
- The `ReasoningEngine` remains the assistant fallback for sources without a
  statement insight (ledger path); `/api/financial/analyze` continues to use it.

## 5. Exact files changed

Added:
- `Backend/HBOS/Product/FinancialDecisionNarrativeService.ts`
- `Backend/HBOS/test/FinancialDecisionNarrativeService.test.ts`
- `Backend/HBOS/test/ProductIntelligenceRuntime.test.ts`
- `web/product-intelligence.test.js`
- `.kilo/evidence/product-intelligence-quality-repair-2026-09-27.txt`

Modified:
- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts`
- `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.test.ts`
- `Backend/HBOS/test/AssistantConversationRuntime.test.ts`
- `web/app.js`

## 6. Exact commits

- `f8e5bc25` — `feat(intelligence): route assistant questions to governed decision-support answers`
  (8 files: the service, runtime wiring, 3 focused test files, 2 updated tests, `web/app.js`).
- Report/evidence commit: this document (docs-only).

## 7. What the product now does

- **Intent-routed assistant:** `RISK`, `SCENARIOS`, `PROFIT_CHANGE`, `DATA_GAPS`,
  `ANALYZE`, `GENERAL` each produce a distinct Persian structure; the response
  also carries `response.intent/sections/scenarios/limitations`.
- **Grounded findings:** strengths/weaknesses/risks/opportunities/actions are
  composed once from verified evidence with evidence levels; a ratio becomes a
  risk only with an explicit rationale/threshold; missing evidence is stated.
- **Exactly three scenarios:** محافظه‌کارانه / متوازن / تهاجمی, each with
  objective, assumptions, actions, expected direction, principal risks, early
  warnings, decision criteria and required evidence. No fabricated future
  numbers.
- **Canonical numbers:** exact grouped magnitudes everywhere derived from the
  same value; the scientific-notation re-localization path is closed.
- **Truthful scope and status:** statement-level analyses with zero transactions
  are labelled as such; `READY` renders as "آماده".
- **No jargon:** no canonical English field names, engine names, raw JSON or
  English limitation text on the normal surface (technical evidence remains in
  the progressive-disclosure payloads).
- **Execution cards:** incomplete plans say so instead of presenting `—`.

## 8. Verification results

Focused (new) tests: **22 passed**
- `FinancialDecisionNarrativeService.test.ts` (9)
- `ProductIntelligenceRuntime.test.ts` (7)
- `web/product-intelligence.test.js` (6)

Affected/existing suites re-run: **14 suites / 102 tests passed**
(FinancialReportRuntime, FinancialContextIntegrity, ReportsExportRuntime,
SourceTrustRuntime, AssistantConversationRuntime, IndependentDualValidationRuntime,
WorkspaceAttentionRuntime, CommercialRuntimeServer.e2e, ApiValidation,
rateLimiting, WebProductAcceptancePacing, CommercialRuntimeServer, web/*,
CommercialWebEntrypoint).

Full regression: **310 suites / 2445 tests passed** (224.351 s).

Golden-case end-to-end (real statement path over HTTP): all assertions pass —
non-empty grounded findings, three scenarios, risk drivers, exact canonical
revenue `۳۲٬۱۲۹٬۴۱۸٬۰۰۰٬۰۰۰` (not `۳۲٬۱۲۹٬۴۰۰٬۰۰۰٬۰۰۰`), data/validation/operational
gap separation, no identifier/English leakage.

## 9. Remaining ACC / PARTIAL / BLOCKED items

- **PARTIAL — decision → execution auto-linking:** recommendations are surfaced
  and execution cards are now truthful; a one-click "create governed work item
  from this recommendation" flow was not added. The existing governed
  `POST /api/execution/work-items` path remains the supported route, and no new
  capability was duplicated.
- **PARTIAL — live online standards verification:** not performed in this
  environment (no authoritative online source); unchanged from the prior
  governance record.
- **ACC items (unchanged, not touched):** duplicate `EngineRegistry`,
  `GovernanceEngine` default-allow / policy consolidation — still require
  Architecture Change Control and were intentionally not modified.
- No item was converted from BLOCKED/PARTIAL to PASS by wording.

## 10. Git state

- LOCAL HEAD (after repair commit): `f8e5bc25`
- ORIGIN HEAD before push: `ddb53e2fc3278f760e948b394bc5aa4bb1904724`
- Push: `f8e5bc25` (and the docs commit) pushed to
  `origin/fix/autonomous-product-factory`.
- `git status`: only the pre-existing untracked scratch/evidence files remain;
  no unrelated tracked file was modified by this repair.

## 11. Final acceptance criteria

1. Questions receive question-specific answers — MET.
2. Meaningful strengths/weaknesses/risks/opportunities when evidence supports —
   MET.
3. Three-scenario requests return three actual scenarios — MET.
4. Risk questions explain drivers rather than restating ratios — MET.
5. Numeric values canonical and consistent — MET.
6. Missing/invalid evidence explicit — MET.
7. Internal jargon hidden from normal users — MET.
8. Recommendations connect to decision/execution where supported — PARTIAL
   (existing governed execution path; no auto-linking added).
9. Existing governed engines used, not bypassed — MET.
10. Reads like a decision-support platform — MET.
