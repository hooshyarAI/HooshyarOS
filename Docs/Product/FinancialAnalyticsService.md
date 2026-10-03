# FinancialAnalyticsService

**Capability:** `product.financial-analytics`
**Owner:** `Backend/HBOS/Product/FinancialAnalyticsService.ts`
**Target engine:** Financial Intelligence Engine
**Composition:** `RatioAnalysisService`, `BreakEvenAnalysisService`, `CashFlowForecastingService`, `AnomalyDetectionService`

## Purpose

Expose the already-realized financial analytics services through one canonical,
tenant-scoped, explainable product result. This service owns **no financial
mathematics**; it validates the tenant boundary, dispatches to the realized
owners and normalizes their deterministic output. It does not create a second
engine and does not duplicate any service.

## Input

```ts
interface FinancialAnalyticsInput {
  tenantId: string;                       // required; boundary is fail-closed
  series?: readonly number[];             // >= 2 finite points: forecast + anomaly
  statement?: RatioStatement;             // ratio analysis (vertical/profitability/leverage)
  priorStatement?: RatioStatement;        // enables horizontal analysis
  breakEven?: BreakEvenAnalysisInput;     // break-even / contribution margin / margin of safety
  movingAverageWindow?: number;           // default 3, clamped to series length
}
```

## Output

```ts
interface FinancialAnalyticsResult {
  capabilityId: "product.financial-analytics";
  targetEngine: "Financial Intelligence Engine";
  tenantId: string;
  ratios: RatioAnalytics | null;
  breakEven: BreakEvenResult | null;
  forecast: ForecastAnalytics | null;
  anomalies: AnomalyAnalytics | null;
  status: "READY" | "BLOCKED";
}
```

A section is present only when its input is supplied. Each sub-result carries the
owning service's own `status`/`method`. The overall `status` is `READY` when at
least one sub-result is `READY`; otherwise it is `BLOCKED`. Missing tenant throws
`financial-analytics-tenant-required`.

## Runtime

| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| POST | `/api/financial/insights` | `INGEST_DATA` | Rate-limited. Optional `sourceSha256` resolves the tenant-scoped canonical model; when `series` is absent the series is derived from canonical net cash movement (`credit - debit`). Persists `financial-analytics:latest` per tenant. |
| GET | `/api/financial/insights/latest` | `READ_DASHBOARD` | Tenant-scoped; `404 ANALYTICS_NOT_FOUND` when none. |

`sourceSha256` must be a 64-hex digest and must resolve inside the caller's
tenant; otherwise the request fails closed. The runtime attaches the canonical
`FinancialSourceEvidence` to the persisted result so the analytics remain
traceable to the ingested evidence.

## Truthful boundary

- Analytics are deterministic and evidence-based; no AI-generated thresholds.
- Sections without sufficient input return `BLOCKED`; values are never invented.
- The persisted report (`/api/report`) appends a financial-analytics section when
  a tenant analytics result exists.
