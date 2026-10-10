# Budget Intelligence Engine

Canonical capability: `platform.budget-intelligence`.

## Existing budget comparison

`analyze` and its canonical alias `analyzeBudget` compare one planned amount with one actual amount. Variance is `actual - planned`; utilization is `actual / planned` when planned is nonzero.

## Cost-center and category variance

`analyzeCostBreakdown({ lines })` calculates:
- total planned cost, actual cost, variance, utilization and variance percentage;
- identical rollups by cost center and cost category;
- line-level variance status;
- fail-closed validation for empty/malformed input, duplicate IDs, invalid amounts, mixed currencies and arithmetic overflow.

Each line requires a unique `lineId`, `costCenterId`, `category`, `currency`, `planned` and `actual`. Currency is normalized to uppercase; mixed currencies are rejected instead of being summed. Group output is sorted deterministically.

Variance is `actual - planned`: a positive value is above plan; a negative value is below plan. If planned cost is zero, utilization and variance percentage are `null` rather than fabricated. Positive actual cost against zero plan is marked `UNBUDGETED_SPEND`.

## Scope boundary

This is budget-versus-actual variance analysis by cost center/category, not a complete costing system. It does not calculate product costs, activity-based costing (ABC), cost-driver rates, standard manufacturing variance, currency conversion or accounting allocations. `READY` means supplied numeric lines passed validation and aggregation; it does not independently verify source-document correctness or managerial acceptance.

## Architecture and reuse

The existing `BudgetIntelligenceEngine` remains the sole calculation owner. No new engine, dependency or alternate calculation service was introduced. The KnowledgeEngine cost-management domain maps to this implemented operation.


## Commercial runtime surface — cost-center analysis

The authenticated runtime exposes `POST /api/budget/cost-breakdown` and `GET /api/budget/cost-breakdown/latest`. The write endpoint requires a tenant-owned uploaded source SHA-256, the `INGEST_DATA` permission and 1–5,000 explicit cost lines. It persists the latest result under the caller's tenant and supports the canonical `Idempotency-Key` mechanism. The read endpoint requires `READ_DASHBOARD` and returns only the current tenant's result.

The Persian web workspace accepts one row per line in this format:
`cost center;category;planned;actual`. The selected canonical upload is linked to the result for traceability; because budget/actual line mappings are entered manually in this version, the persisted record truthfully keeps `qualification=REVIEW_REQUIRED` and `source.linkStatus=LINKED_NOT_RECONCILED`. It does not present the amounts as independently reconciled facts.
