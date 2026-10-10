# Budget cost-management runtime surface

**Capability:** `product.cost-management`  
**Calculation owner:** `BudgetIntelligenceEngine`  
**Runtime owner:** `CommercialRuntimeServer`  
**Storage:** tenant-scoped `SQLitePersistenceStore`

## Endpoints

| Method | Path | Permission | Behavior |
|---|---|---|---|
| POST | `/api/budget/cost-breakdown` | `INGEST_DATA` | Calculate and persist the latest planned-vs-actual cost analysis linked to an uploaded source. |
| GET | `/api/budget/cost-breakdown/latest` | `READ_DASHBOARD` | Retrieve the latest analysis for the active tenant only. |

The write endpoint requires a 64-character SHA-256 resolving to a source already ingested under the same tenant. It rejects invalid or missing source identifiers, unknown sources, malformed line arrays and more than 5,000 rows. Duplicate line IDs, invalid amounts, mixed currencies and overflow are rejected by `BudgetIntelligenceEngine`.

## Trust boundary

The result is persisted with `qualification=REVIEW_REQUIRED` and `source.linkStatus=LINKED_NOT_RECONCILED`. The source link proves only that a canonical upload exists for the same tenant; it does not prove that manually entered budget/actual rows match that source. The UI explicitly discloses this limitation; the result is not an audited accounting finding.

## UI

The Persian workspace accepts semicolon-separated lines: `cost center;category;planned;actual`, using one currency/unit for the whole analysis. It displays total variance plus cost-center/category summaries. The persisted latest result is tenant-isolated and reloads from SQLite.
