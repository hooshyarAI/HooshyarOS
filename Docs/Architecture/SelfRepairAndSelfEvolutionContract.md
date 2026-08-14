# Self-Repair & Self-Evolution Contract

## Status

Architecture and operational contract for `assistant.autonomous.self-repair`.

## Non-bypassable rule

Every platform failure enters:

`AUDIT → DIAGNOSE → ROOT-CAUSE CLASSIFY → DECIDE → REPAIR → TEST → INTEGRATE → VERIFY → EVIDENCE → COMMIT → RE-AUDIT`

Manual repair is not a primary strategy. It is permitted only after the autonomous boundary is proven with `BLOCKED_WITH_PROOF` evidence.

## Engine responsibilities

- **Reasoning Engine:** symptom/root-cause separation, diagnosis and alternatives.
- **Decision / Expert Choice:** proportional strategy selection using risk, reversibility, architectural fit and evidence.
- **Governance Engine:** architecture ownership, security and freeze-boundary enforcement.
- **Memory Engine:** failure, strategy, outcome and prevention memory.
- **Autonomous Operations Engine:** repair execution, verification, integration and acceptance.
- **Organizational / Executive Intelligence:** translate recurring technical failure into resilience, product-quality and business-risk signals.

## Proportional repair depth

1. `LOW` — focused canonical repair.
2. `MEDIUM` — canonical repair plus architectural contract analysis.
3. `HIGH` — dependency/toolchain and isolation alternatives become eligible.
4. `CRITICAL` — architecture/release/security boundaries and deeper redesign are considered.

Escalation requires evidence. Repeating a failed strategy without materially new evidence is forbidden.

## Failure budget

The default autonomous execution budget is five distinct strategies. Exhaustion produces `BLOCKED_WITH_PROOF`, not an unqualified failure.

## Verification gate

A repair is `FIXED` only when execution succeeds, verification succeeds, and state change is evidenced. Repository change is sufficient for code repairs; verified environment change or an explicitly verified idempotent operation is sufficient for provisioning/runtime repairs.

## Blocked With Proof

A blocked case records:

- root-cause class;
- exact failure;
- attempted strategies;
- execution and verification evidence;
- external boundary, when one actually exists;
- reason autonomous continuation cannot proceed;
- resume condition.

## Self-evolution

Successful and failed repair cases are memory inputs. Future strategy selection must exclude previously failed strategies unless materially new evidence changes the decision state.

## Product trust principle

HooshyarOS is its own first customer: the platform must be able to audit, repair, verify and learn from failures in its own construction and productization lifecycle before claiming equivalent autonomous reliability for organizational customers.
