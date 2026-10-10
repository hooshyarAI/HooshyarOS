# FinancialFeasibilityService

**Capability:** `product.financial-feasibility`  
**Owners:** existing `FinancialIntelligenceEngine` and `RiskIntelligenceEngine`.

Composes the canonical NPV, IRR and payback calculations with five deterministic cash-flow sensitivity scenarios (-20%, -10%, baseline, +10%, +20%). The service validates a tenant, project name, currency/unit, positive initial investment, 1–50 finite future cash flows and a non-negative decimal discount rate. A non-convergent IRR stays BLOCKED and is not replaced by zero.

The web runtime exposes authenticated tenant-scoped `POST /api/feasibility/financial` and `GET /api/feasibility/financial/latest`; writes use the existing rate limit, idempotency and SQLite persistence. The result is always `REVIEW_REQUIRED`: cash flows and discount rate entered by the user are linked to an uploaded source only for traceability and are not automatically reconciled to it. This is an initial financial worksheet, not a complete technical, market, legal, operating, environmental or tax feasibility report.
