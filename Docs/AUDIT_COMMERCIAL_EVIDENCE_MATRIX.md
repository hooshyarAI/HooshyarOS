# Commercial Evidence Matrix

Canonical audit model for `CommercialProductCompletionAudit`.

A commercial layer is VERIFIED only when repository-native evidence reaches the required evidence level defined by `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md`.

| Layer | Minimum evidence gate |
|---|---|
| Product runtime | Application + persistence + health/readiness behavior |
| Identity | Application authentication/session behavior + security event evidence |
| Multi-tenancy/authorization | Integration/application tenant isolation + cross-tenant rejection |
| Data ingestion | Integration + application ingestion path + provenance/fail-closed evidence |
| Financial intelligence | Integration + application/representative financial analysis evidence |
| Executive intelligence | Application KPI/target/alert/drill-down evidence |
| Decision intelligence | Application scenario/criteria/recommendation + approval evidence |
| Organizational execution | Application decision-to-workflow evidence |
| Dashboards/reports | Application rendering/interaction + report/export evidence |
| Web/mobile | Responsive application evidence; native only if frozen scope requires it |
| Offline/online | Sync/conflict application evidence when offline is in scope |
| Security/privacy | Security behavior + audit logging + recovery/policy evidence |
| Observability | Product runtime health/readiness/errors/telemetry/audit evidence |
| Deployment | Reproducible install/build/start/health evidence |
| Subscription | Plan/entitlement/tenant-state/limits/provider-boundary evidence when in scope |
| Onboarding | End-to-end representative user-value path |

Presence of an engine, directory, documentation file, or unit test alone is never sufficient for commercial completion.
