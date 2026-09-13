# HooshyarOS Real Product Operation Law

**Status:** Canonical operational quality law
**Authority:** Product acceptance and operational evidence only. Architecture Freeze V4, Master Charter, Governance Charter and the Commercial Product Completion Contract remain authoritative for architecture and governance.

## Purpose

HooshyarOS is not commercially complete because a page renders, a server starts, source files exist, or unit tests pass. A capability is commercially accepted only when the corresponding user-visible behavior and system behavior are exercised through a real runnable path and backed by reproducible evidence.

## Non-negotiable rule

> **No feature, release, platform, installer, dashboard, assistant flow, financial workflow, security boundary, or commercial completion state may be declared complete from implementation presence alone.**

The minimum proof chain is:

`Implementation → Focused Test → Integration Verification → Real Runtime Execution → Application Acceptance → Evidence → Audit`

## Required real-product surfaces

The acceptance program must cover, as applicable to the product surface:

1. install and launch
2. authentication and session lifecycle
3. organization and tenant context
4. tenant isolation and authorization
5. real financial data ingestion
6. validation and canonicalization
7. financial analysis and explainable results
8. dashboard KPIs and drill-downs
9. report generation and retrieval
10. assistant interaction with actual persisted product context
11. decision and executive intelligence workflows
12. persistence across restart
13. recovery of the same tenant and data
14. security denial/authorization behavior
15. Web/PWA application behavior
16. Windows installable/runtime behavior
17. Android build/install/launch/smoke behavior when the Android client is in scope

## Evidence rules

- Hard-coded sample output is not product evidence.
- Static file presence is not runtime evidence.
- Unit tests alone are not application acceptance.
- A green build without an executable acceptance path is not commercial readiness.
- External production dependencies must be explicitly probed or remain blocked.
- Evidence must identify the tested commit and the execution target.
- Evidence generated for an earlier commit must never qualify a later commit.
- Failure evidence must be preserved and must not be rewritten merely to obtain PASS.

## Autonomous execution law

The autonomous construction system must continue through repository-native gaps without routine human driving:

`AUDIT → DISCOVER → SELECT ONE REAL GAP → IMPLEMENT → FOCUSED VERIFY → INTEGRATE → REAL ACCEPTANCE → EVIDENCE → COMMIT → PUSH → RE-AUDIT`

Python is the first-choice construction worker for analysis, orchestration, evidence and repair. The canonical Assistant/TypeScript orchestration owns architecture decisions and mission ordering. Approved implementation workers may include Kilo when selected by the platform's tool policy. No worker may declare completion by bypassing an acceptance gate.

## Human-intervention boundary

Human intervention is required only where the evidence boundary genuinely crosses outside the repository and local execution environment, such as:

- production credentials
- payment-provider activation
- production cloud resources
- external DNS/service ownership
- physical device access when a device is required and no approved automated runner exists
- business/legal approvals

The autonomous system must never simulate these conditions.

## Final completion criterion

`productComplete=true` is valid only when:

- all required repository-native commercial capabilities have real acceptance evidence;
- required Web/Windows/Android acceptance paths for the declared release scope have passed;
- persistence/recovery and security acceptance have passed;
- the commercial completion audit passes against the same commit;
- external dependencies are either genuinely verified as ready or the release remains explicitly blocked;
- no stale evidence is used to qualify the current commit.

A product that only displays a UI shell, placeholder dashboard, sample data flow, or mock commercial behavior is **not** accepted.
