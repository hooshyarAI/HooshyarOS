# Autonomous Master Execution Policy

Status: GOVERNING
Canonical branch: `agent/release-final`
Engineering checkpoint: `3f0947d2`
Stable engineering baseline: `stable-baseline-2026-08-18` (`cc8ac936`)

## Mission
Continue HooshyarOS construction, commercialization readiness, and real standardization from the verified engineering checkpoint until the mandatory gates are satisfied.

## Autonomous cycle
AUDIT → DISCOVER → ANALYZE → RISK ASSESS → PRIORITIZE → PLAN → IMPLEMENT/REPAIR → FOCUSED VERIFY → INTEGRATE → FULL VERIFY AT CHECKPOINT → EVIDENCE AUDIT → COMMERCIAL RE-EVALUATION → NEXT CAPABILITY.

## Decision policy
Use repository evidence as the primary source of truth. Apply SWOT/PESTLE, stakeholder analysis, risk matrix, sensitivity analysis, AHP/TOPSIS, scenario planning, Monte Carlo, Pareto, trend analysis, break-even, and Delphi only when the selected problem benefits from them. Do not run methods mechanically.

## Promotion gates
A capability is not complete because files exist. Require requirement evidence, correct canonical artifact boundary, behavioral verification, integration verification when applicable, and repository evidence. Missing or contradictory evidence is fail-closed.

## Priority
1. P0 security, authorization, tenant isolation, customer-data/knowledge isolation
2. P0 persistence, backup, restore, integrity, recovery
3. P0 real ingestion, provenance, reconciliation, trust
4. P1 accounting/ERP/API integrations
5. P1 financial intelligence and decision support
6. P1 production deployment, observability, SLA and operations
7. P1 Iranian legal/tax/compliance readiness
8. P1 controlled 30/60/90-day customer trial and value measurement
9. P2 UX, dashboards, reporting, performance and scale
10. Final commercial-readiness and standardization audit

## Construction boundary
Product capabilities must use the exact artifact paths declared by the durable product roadmap. Do not substitute target-engine paths. Existing verified implementations must be inspected and preserved; tests and documentation must match real APIs rather than invented scaffolds.

## Autonomous repair safety
Never push incomplete construction. Never finalize when required artifacts are missing, when tests contradict the implementation, when checkpoint rollback is not clean, or when evidence is incomplete. Preserve failed-cycle artifacts as evidence before cleanup when practical.

## Customer-data isolation
Customer data, models, formulas, methods, knowledge, evidence and derived insights remain customer-scoped. They must not be exposed, cross-loaded, or reused across customers without explicit scoped authorization.

## Commercial model
30-day controlled free trial by default; extend to 60 or 90 days only when justified by value-measurement evidence. Convert only after customer acceptance and measured value to monthly/quarterly/annual subscription with appropriate discounting.

## Completion condition
Do not declare Commercial Ready until all mandatory P0/P1 evidence gates pass and the final standardization audit is green.