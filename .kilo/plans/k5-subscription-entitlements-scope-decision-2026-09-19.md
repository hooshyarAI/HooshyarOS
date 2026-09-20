# K5 — `commercial.subscription-entitlements` — Governed Scope Decision (2026-09-19)

**Type:** Governed product-owner decision record (read-only audit + classification; no implementation).
**Branch:** `fix/autonomous-product-factory`
**Baseline trusted checkpoint:** `cd4792507a69c868c57a9aec49e6f247f4bc2791` (local == origin, `0/0`)
**Status:** `GOVERNED_DECISION_REQUIRED` — scope is **not** explicitly defined by any governing artifact, so no pricing/business rule was invented.
**Architecture baseline:** Architecture Freeze V4.1 preserved. Five canonical engines untouched. No sixth engine.

## 1. What the governing sources actually say

- `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md:227` §15 "Subscription and commercial controls" is **conditional**:
  > `If subscription/billing is part of the approved commercial scope, define and implement:` plan model · entitlement model · tenant subscription state · usage/limits · trial/expiry behavior · billing-provider integration boundary · secure webhook/event handling · entitlement enforcement.
- `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md:240` states payment-provider activation is an external dependency.
- `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md:320` lists `billing/subscription` as priority **13** of the MVP heuristic (after packaging/PWA, before external integrations).
- `Docs/HOOSHYAROS_MASTER_CHARTER.md` records K5 as `CONDITIONAL` / scope-gated (B2 external + unconfirmed scope).

No governing artifact in this repository asserts that subscription/billing **is** part of the approved commercial scope. The clause is explicitly conditional.

## 2. Current repository truth (fresh, 2026-09-19)

- `git grep -il -E "subscription|entitlement"` across tracked `Backend/**/*.ts`, `web/*.js`, `scripts/*.cjs`, `package.json` returns **no implementation files**. The only matches are the contract clause itself and historical audit/ledger records.
- There is no plan model, entitlement model, tenant subscription state, usage/limit model, trial/expiry behavior, billing-provider boundary, webhook handling or entitlement enforcement anywhere in the product/runtime.
- `ExternalProductionDependencyAudit` leaves payment-provider activation `BLOCKED` unless `HOOSHYAR_PAYMENT_PROVIDER_ACTIVATED=1` (B2).

This confirms K5 is a **real repository-local gap only if** subscription/billing is in scope.

## 3. Decision

Per the mission rule *"If scope is not explicitly defined, DO NOT invent pricing/business rules. Record it as a governed product-owner decision with exact missing scope"*, K5 is classified:

**`GOVERNED_DECISION_REQUIRED`** — not `IMPLEMENT_NOW`, not `HOST_EXECUTABLE_NOW`.

No pricing, plan tier, quota, trial length, entitlement rule, webhook contract or provider integration was invented or stubbed.

## 4. Exact missing scope (what the product owner must decide)

1. **Is subscription/billing in the approved commercial scope at all?** (The contract gates the entire layer on this.)
2. If yes, the **plan model**: plan identifiers, tiers, and whether plans are global or tenant-defined.
3. The **entitlement model**: which canonical capabilities/features are gated, and the mapping (plan → entitlement set).
4. **Tenant subscription state**: states/lifecycle (`trialing`, `active`, `past_due`, `canceled`, `expired`) and transition rules.
5. **Usage/limits**: metered dimensions (sessions, tenants, sources, analyses, exports, problems) and their limits/enforcement point (HTTP boundary vs engine).
6. **Trial/expiry behavior**: duration, what happens at expiry, grace/suspension semantics.
7. **Billing-provider choice + integration boundary**: provider, checkout/hosted page, customer/portal identity mapping (external, B2).
8. **Secure webhook/event handling**: signature verification, replay protection, idempotency, and the canonical persistence owner for subscription events.
9. **Entitlement enforcement**: fail-closed behavior and where it is enforced in the frozen 4-layer security model.

Items 1–6 and 9 are repository-local once scoped; items 7–8 depend on external provider selection (B2).

## 5. Effect on readiness

- K5 remains `CONDITIONAL` / `GOVERNED_DECISION_REQUIRED`; it is **not** dependency-ready.
- No completion flag changed. `productComplete` remains **FALSE**.
- No source, test, architecture, governance rule, ledger status or runtime behavior changed by this record.

## 6. Truth boundary

This record is an audit/decision artifact, not a capability. It does not claim subscription support, does not create a stub, and does not weaken any gate. If the product owner returns a confirmed scope, K5 becomes an implementable repository-local knot and must be built through the canonical product/runtime owners (no parallel billing engine).
