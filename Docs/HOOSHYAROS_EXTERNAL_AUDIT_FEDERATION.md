# HooshyarOS External Audit Federation

**Status:** GOVERNING AMENDMENT / AUDIT-ONLY / COMMERCIALIZATION ACCELERATOR
**Architecture baseline:** Architecture Freeze V4
**Scope:** External independent audit and refinement of HooshyarOS architecture, laws, charter, reasoning, engines, decisions, capabilities, contracts, dependencies and runtime behavior.

## 1. Purpose

HooshyarOS shall use complementary external engineering/intelligence tools to increase the quality and speed of architecture audit, contradiction detection, root-cause analysis and commercialization readiness.

The objective is **faster standardization and safe commercialization**, not faster accumulation of code.

## 2. Approved External Audit Roles

### Cursor — implementation-surface auditor

Cursor may be used to inspect the repository, trace implementation-to-contract relationships, detect dead code, duplicated ownership, missing tests, inconsistent interfaces and implementation drift.

Cursor findings are evidence only. Cursor has no authority to redefine architecture or governance.

### Claude Code — independent architecture/reasoning reviewer

Claude Code may be used as an adversarial second opinion for architecture, logic, laws, charter consistency, engine boundaries, capability ownership, decision rationale, failure theory and cross-component reasoning.

Claude findings are evidence only. Claude has no authority to approve architectural change.

### Zapier — audit orchestration and evidence routing

Zapier may orchestrate external audit workflows such as:

- dispatching audit requests;
- collecting reports;
- routing findings to the canonical evidence store;
- notifying the responsible review path;
- correlating repeated findings;
- triggering re-audit after a verified repair.

Zapier is an orchestration boundary, not an architectural authority and not a code-generation dependency.

## 3. Independence Rule

External tools must audit independently from the primary construction reasoning whenever practical.

A finding becomes actionable only after repository evidence confirms it.

Agreement between two AI tools is **not** proof.

Disagreement is valuable evidence and must trigger explicit reconciliation rather than averaging opinions.

## 4. Audit Dimensions

Every deep audit may examine:

1. architecture and engine ownership;
2. charter, governance and engineering laws;
3. product philosophy and mission alignment;
4. reasoning and decision logic;
5. capability completeness and genuine-missing-capability detection;
6. dependency and communication contracts;
7. lifecycle, boot and runtime behavior;
8. autonomous construction and recovery logic;
9. security, authorization and tenant boundaries;
10. explainability, evidence and auditability;
11. persistence, recovery and resilience;
12. commercial readiness and productization boundaries;
13. test quality and false-green risk;
14. documentation-to-code consistency;
15. performance and operational constraints;
16. Iranian-market commercialization readiness.

## 5. Finding Classification

Every finding must be classified as one of:

- `CONTRADICTION` — two governing rules or contracts conflict;
- `ARCHITECTURE_DRIFT` — implementation violates Architecture Freeze V4;
- `OWNERSHIP_DRIFT` — capability has an incorrect or duplicate owner;
- `LOGIC_DEFECT` — behavior or reasoning is incorrect;
- `MISSING_CAPABILITY` — a genuinely required capability is absent;
- `INTEGRATION_DEFECT` — components do not cooperate according to contract;
- `EVIDENCE_DEFECT` — claimed completion lacks independent proof;
- `TEST_DEFECT` — test is missing, weak, misleading or falsely green;
- `COMMERCIAL_READINESS_GAP` — product cannot yet be safely tested or commercialized;
- `DOCUMENTATION_DRIFT` — repository documentation disagrees with executable reality;
- `OBSERVABILITY_GAP` — behavior cannot be adequately inspected or recovered;
- `SECURITY_GAP` — security or authorization invariant is insufficient.

## 6. Evidence Standard

No external finding may directly change code or architecture.

The required sequence is:

**External Finding → Repository Evidence → Root Cause → Governing Decision → Minimal Repair → Focused Test → Integration Verification → Architecture Audit → Commit → Re-audit**

A finding without repository evidence remains a hypothesis.

## 7. Architecture Protection

External audit must never be used to justify redesign merely because implementation is difficult.

Architecture changes require evidence of a genuine contradiction, missing architectural capability or unacceptable production constraint, followed by an explicit governing decision.

## 8. Construction Boundary

External audit tools are **not members of the autonomous construction authority**.

The canonical construction authority remains the repository-native HooshyarOS construction fabric. External tools may inspect, challenge, correlate and report; they may not silently become dependencies of autonomous construction.

## 9. Commercialization Gate

The audit federation exists to reduce the distance between the current platform and a safe Iranian-market test release.

Commercialization readiness must therefore be evaluated continuously against:

- functional capability;
- reliability;
- security;
- explainability;
- governance;
- persistence and recovery;
- observability;
- installation/deployment;
- data isolation;
- financial-domain correctness;
- operational usability;
- evidence-backed product acceptance.

No commercial claim is accepted merely because the codebase is large or CI is green.

## 10. Mandatory Operating Loop

The permanent audit/refinement loop is:

**AUDIT → CHALLENGE → CORRELATE → PROVE → CLASSIFY → DECIDE → REPAIR → VERIFY → STANDARDIZE → COMMERCIALIZE → AUDIT AGAIN**

The loop continues until the repository reaches an evidence-backed production-ready state or an explicit BLOCKED state.

## 11. Audit Record

Each audit cycle must preserve, at minimum:

- audit timestamp;
- repository commit/ref;
- audit dimensions;
- tools/agents used;
- findings;
- evidence references;
- severity;
- root cause;
- governing decision;
- repair commit;
- verification evidence;
- unresolved findings;
- commercialization impact.

This document is the governing contract for the external audit federation. It does not grant any external tool authority to alter HooshyarOS architecture autonomously.
