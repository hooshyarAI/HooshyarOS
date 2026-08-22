# HooshyarOS Canonical Refinement Plan

## Audit basis
This plan is derived from the reconciled evidence of:

1. Python repository/evidence audit.
2. DeepSeek independent adversarial audit and source-evidence re-audit.
3. Claude independent second adversarial audit.
4. Direct source verification of the highest-risk findings.

## Status model
A capability may advance only through:

DOCUMENTED → IMPLEMENTED → BEHAVIORALLY VERIFIED → INTEGRATION VERIFIED → PRODUCTION VERIFIED → COMMERCIAL READY

## P0 — Safety and evidence integrity

### P0.1 Autonomous repair must fail closed
The commercial autonomous repair path must never manufacture implementation/tests and then commit/push them as proof of repair.

Current correction: `Backend/AI_Runtime/commercial_autorepair.py` is diagnostic-only and fails closed with `independent-repair-verification-required`.

Acceptance:
- No automatic source/test replacement in the commercial repair path.
- No autonomous git commit/push from that repair path.
- Independent verification required before any future governed mutation.

### P0.2 Authorization and tenant enforcement
All commercial operations must pass one authorization boundary and explicit tenant scope enforcement.

Acceptance:
- Missing/revoked session denied.
- Wrong organization denied.
- Wrong tenant denied.
- Permission matrix independently tested.

### P0.3 Durable identity and persistence
Identity/session state and commercial persistence must survive process restart and remain tenant-scoped.

Current correction:
- SQLite durable persistence store added.
- SQLite durable identity/session/audit store added.
- Commercial Identity Service connected to durable storage.
- Tenant-scoped persistence and restart tests added.

Acceptance:
- Restart retention verified.
- Tenant A cannot read Tenant B data.
- Revocation persists across restart.
- Audit trail persists across restart.

## P1 — Verification integrity

### P1.1 Detect and reject tautological tests
Tests that only assert the same hard-coded literal emitted by the implementation are not sufficient verification.

Acceptance:
- Static detector identifies circular implementation/test literals.
- Completion gate refuses such evidence as `VERIFIED`.

### P1.2 Distinguish scaffold from implementation
Documentation or one-line scaffold classes must never count as delivered capability.

Acceptance:
- Capability status explicitly records `SCAFFOLD`/`DOCUMENTED` before `IMPLEMENTED`.
- Engine specification files cannot promote a capability to implementation status.

### P1.3 Remove duplicate capability roots
Resolve `Backend/AI_Runtime` versus `Backend/AI/_Runtime` duplication where the same ownership/class names exist.

Acceptance:
- One canonical runtime root per capability.
- CI fails on duplicate top-level capability ownership.

## P1 — Product trustworthiness

### P1.4 Real data ingestion
Provide at least one real, end-to-end supported ingestion path with provenance and validation.

### P1.5 Observability
Health must check real dependencies and runtime state; add structured logging and measurable metrics.

### P1.6 Performance evidence
Introduce real startup, latency, load and stress evidence for critical runtime paths.

### P1.7 Productization verification
Windows/Android/Web acceptance must prove user-facing runtime behavior, not merely artifact existence.

## P2 — Commercial hardening

- durable production-grade storage strategy beyond the local embedded baseline when required by deployment scale;
- secrets management and encryption;
- rate limiting and stronger input validation;
- real cloud-provider integrations;
- decision intelligence / Expert Choice implementation where contractually required;
- organizational workflow execution;
- production-grade mobile/offline strategy;
- subscription, billing and onboarding.

## Governance rule
No new feature may override this ordering unless a source-backed dependency argument is recorded and independently reviewed.

No production/commercial completion claim is valid while any P0 remains open or while evidence only proves file existence.
