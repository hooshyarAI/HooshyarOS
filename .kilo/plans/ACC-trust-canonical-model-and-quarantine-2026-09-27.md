# ACC ITEM — CANONICAL-MODEL TRUST FIELD & PERSISTENT QUARANTINE STATE

Status: **REQUIRES_ARCHITECTURE_CHANGE_CONTROL**
Date: 2026-09-27
Branch: `fix/autonomous-product-factory`
HEAD at authoring: `beb494e9`
Model: `deepseek/deepseek-flash` (no Pro model)
Author: Kilo (bounded execution layer) — no code change made for this item

## CURRENT STATE
`Backend/HBOS/Product/TrustAssessment.ts` computes an explicit trust lifecycle
(`RECEIVED → IDENTIFIED → VALIDATED → CROSS_CHECKED → RECONCILED → TRUSTED`,
plus `QUARANTINED`/`REJECTED`) over an already-accepted canonical
`FinancialIngestionResult`. It is consumed additively by the runtime
(`CommercialRuntimeServer.ts`): the assessment is attached as a backward-compatible
`trust` sibling on `/api/financial/insights`, `/api/financial/insights/latest`,
`/api/report`, `/api/assistant` evidence and `/api/dashboard`.

What is deliberately **not** done, because it would mutate frozen contracts:
- Injecting a `trust` field **into** the canonical `FinancialCanonicalModel` /
  `FinancialIngestionResult` schema owned by the protected
  `FinancialDataIngestionAdapter.ts`.
- Persisting a durable `QUARANTINED` state per source (the assessment is
  recomputed on demand; it is not stored on the canonical record).
- Adapter-boundary rejection/rewriting of intra-source duplicate ledger rows.

## CONFLICTING IMPLEMENTATION / CONSUMERS
- The canonical ingestion schema is owned by the protected
  `FinancialDataIngestionAdapter.ts` and is consumed by analysis, analytics,
  insights, reporting, assistant and the offline/online client path.
- `FinancialDataIngestionAdapter.ts` and its tests are protected from
  modification (project constraint). Adding a persisted `trust`/`QUARANTINED`
  field changes the frozen record shape and every exact-record assertion.
- Quarantine-as-persistent-state additionally introduces a write path that can
  block a source, which is a product/governance posture decision (who may clear
  a quarantine, with what authority and audit trail).

## ARCHITECTURAL IMPACT
- Mutating the canonical model adds a mutable, security-relevant classification
  into the frozen ingestion contract and couples ingestion to the trust
  lifecycle.
- A persistent quarantine gate would change which sources may be analyzed and
  reported, affecting every downstream consumer and audit surface.

## PROPOSED TARGET (for governance decision — not executed)
1. Decide whether trust/quarantine is (a) a derived, recomputed projection
   (current posture), (b) a durable side-record keyed by `sha256` that never
   mutates the canonical model, or (c) an inline canonical field.
2. If durable, define the governed clear/quarantine authority, tenant boundary,
   audit event and retention. Option (b) is the least invasive and preserves the
   protected adapter.
3. Only after a decision, extend the ingestion contract under Architecture
   Change Control with migration of the exact-record tests.

## MIGRATION RISK
- Medium: touches the protected ingestion schema and/or adds a persisted state
  machine consumed by analysis, reporting and the client path.

## TESTS REQUIRED BEFORE ACCEPTANCE
- Reconfirmation of `FinancialDataIngestionAdapter.test.ts` and every exact-record
  runtime assertion.
- New test: a quarantined source is consistently refused (or consistently
  labelled) across analysis, insights, report and assistant.
- New test: clearing a quarantine is authorized, tenant-scoped and audited.

## REASON ACC IS REQUIRED
This mutates a frozen canonical contract and/or introduces a persisted governance
state on the ingestion boundary. It must not be changed silently by the bounded
execution operator.

## DECISION
No change performed. Additive, non-mutating trust propagation is delivered and
verified; the canonical-model/persistent-quarantine question is preserved for
Architecture Change Control.
