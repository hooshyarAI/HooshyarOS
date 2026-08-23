# External Audit Federation Charter

**Status:** GOVERNING / AUDIT-ONLY / ANTI-DRIFT
**Canonical branch:** `agent/release-final`
**Architecture baseline:** Architecture Freeze V4

## Purpose

HooshyarOS shall use independent external tools as adversarial auditors and evidence producers for architecture, laws, reasoning, engines, decisions, capabilities, interfaces, dependencies and runtime behavior.

This federation is an **audit layer, never a construction dependency**.

## Participants

1. **Python** — canonical repository audit, evidence normalization, deterministic cross-checking and repair orchestration.
2. **GitHub** — canonical repository/source-control evidence and publication boundary.
3. **Assistant** — architecture reasoning, expert choice, contradiction analysis and final engineering judgment.
4. **Cursor** — independent code/architecture reviewer when available; advisory evidence only.
5. **Claude Code** — independent adversarial code/architecture reviewer when available; advisory evidence only.
6. **Zapier** — audit workflow/event orchestration and evidence routing when available; never a source of architectural truth.

## Separation of powers

External auditors may inspect, challenge, compare, classify and report. They may not directly alter the canonical repository, rewrite architecture, weaken tests, approve their own findings, or become required runtime dependencies of autonomous construction.

No external auditor may declare HooshyarOS correct merely because its own analysis succeeds.

## Audit scope

Every federation audit may challenge:

- architecture boundaries and ownership;
- governing rules and charter consistency;
- product philosophy and mission alignment;
- engine responsibilities and duplication;
- dependency direction and lifecycle contracts;
- capability completeness and genuine-missing-capability selection;
- decision logic and rationale;
- autonomous reasoning and execution laws;
- security, authorization and tenant isolation;
- persistence, recovery and rollback;
- data provenance and trust;
- integration contracts;
- tests versus real implementation;
- documentation versus implementation;
- commercial-readiness claims;
- runtime evidence and observed behavior;
- contradictions between governing documents and code.

## Mandatory evidence model

Each audit finding must identify:

- auditor identity;
- repository commit/checkpoint;
- inspected artifact(s);
- claim under examination;
- evidence supporting the claim;
- severity/risk;
- confidence;
- contradiction, if any;
- recommended verification;
- whether the finding is actionable without human product/architecture approval.

## Consensus law

Agreement between Cursor, Claude Code, Python or Zapier is **not** proof of correctness.

Disagreement is evidence requiring investigation.

The final truth hierarchy remains repository evidence, executable behavior, tests and governing architecture. External opinions are independent challenge evidence.

## Repair law

When federation findings identify a credible defect:

**DETECT → CORRELATE EVIDENCE → CLASSIFY ROOT CAUSE → CHECK ARCHITECTURE OWNER → MINIMAL REPAIR → FOCUSED VERIFY → INTEGRATION VERIFY → RE-AUDIT → ACCEPT OR BLOCK**

No repair may be made merely to satisfy an external auditor's preference.

## Anti-drift rule

The federation must never become a new engine hierarchy, product capability owner, autonomous construction provider, or architectural authority.

The existing Architecture Freeze V4 remains sovereign.

## Tool availability rule

If Cursor, Claude Code or Zapier is unavailable, the audit cycle does not invent substitutes or silently claim equivalent evidence. The missing auditor is recorded as unavailable, and Python/GitHub/Assistant continue only within the evidence level they can actually prove.

## Completion rule

A federation audit is complete only when:

- evidence was collected from every available independent participant;
- disagreements were explicitly classified;
- high-risk contradictions were resolved or BLOCKED;
- repairs were independently re-verified;
- the resulting evidence is committed to repository memory.

**Mantra:** Independent challenge improves HooshyarOS; independent tools do not govern HooshyarOS.
