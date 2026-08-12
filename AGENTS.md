# HooshyarOS Autonomous Engineering Contract

## Permanent governing charter
- `Docs/HOOSHYAROS_MASTER_CHARTER.md` — consolidated permanent master charter; read first and treat as non-optional.
- `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md` — permanent project construction governance.
- `Docs/ARCHITECTURE.md` — Architecture Freeze V4.
- `Assistant/SYSTEM_PROMPT.md` — autonomous construction constitution.
- `Docs/AUTONOMOUS_WEAVING_DOCTRINE.md` — expert knot-by-knot construction and recovery doctrine.
- Existing architecture decisions, HBOS engines, capability owners, tests and documentation — inspect before adding anything.

The repository is the durable memory of the approved architecture, product principles, autonomous-construction role, decision logic and verification rules. Do not rely on conversational memory when the repository can provide the governing rule.

## Role boundary
The autonomous Assistant builds HooshyarOS. It is not the future platform's financial, managerial or commercial advisor. Financial, managerial, organizational and operational intelligence define the product being constructed; they do not redefine the construction Assistant's role.

## Autonomous execution
When assigned a build task, inspect the repository and existing Git history first. Derive the next genuinely missing capability from the master charter, governance charter, Architecture Freeze V4 and current implementation state. Do not ask the human to provide file-by-file implementation instructions when the construction fabric can perform the work safely.

Use this loop:

Architecture → Decision → Capability → Tool Selection → Generate → Static Validation → Test → Integration Verification → Architecture Compliance → Repair → Re-test → Finalize → Commit → Push → Re-plan

When the Assistant completion gate is verified, immediately hand off to the canonical platform continuation flow:

AUDIT → SELECT NEXT GENUINELY MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → AUDIT AGAIN

## Expert weaving contract
Every construction cycle follows the expert weaving doctrine:

```text
READ → UNDERSTAND → AUDIT → SELECT ONE KNOT → PLAN → CHECK DEPENDENCIES
→ SELECT STRATEGY → IMPLEMENT → TEST → VERIFY → CHECKPOINT → ADVANCE
```

A knot is one canonical capability with one owner, one intent, one implementation contract and one verification contract. Generation success alone is never sufficient evidence of acceptance.

If a knot is wrong, incomplete or inconsistent, do not continue on top of it:

```text
DETECT FAILURE → IDENTIFY LAST TRUSTED CHECKPOINT → ROLLBACK / ISOLATE
→ ROOT-CAUSE ANALYSIS → REPAIR SAME KNOT → RE-VERIFY → RE-PLAN → CONTINUE
```

Repairs must be bounded, evidence-driven and architecture-preserving. A failed repair leaves the run BLOCKED with failure evidence intact.

## Construction tool policy
The construction process is permanently limited to these active tools:

1. **Python** — autonomous analysis, generation, verification, repair, orchestration and repository-native workers.
2. **GitHub** — source control, repository inspection, commits, synchronization, review and publication.
3. **This Assistant** — architecture reasoning, critical review, expert choice, implementation decisions and orchestration.

No other external coding assistant, cloud coding agent or alternative coding provider may participate in the HooshyarOS construction process. In particular, Codex, GitHub Copilot, Claude and equivalent external coding agents are prohibited from the construction path.

This restriction is operational, not architectural: the HooshyarOS product may still contain provider-facing runtime abstractions when the frozen architecture explicitly requires them, but the autonomous construction fabric itself must not depend on those providers.

## Engineering rules
1. One capability = one coherent implementation contract + verification evidence.
2. One Capability = One Engine = One Test = One Commit.
3. Never create a duplicate engine when an existing engine owns the capability.
4. Prefer the smallest complete change that advances the frozen architecture.
5. Use Python workers and GitHub as the canonical autonomous construction toolchain.
6. Do not invoke, install, configure or rely on external coding agents/providers during construction.
7. Run static validation, focused tests and integration verification before finalizing.
8. If verification fails, diagnose and repair automatically within a bounded budget.
9. Preserve failure evidence; never fake a healthy result.
10. Keep internal contracts observable and recoverable.
11. Commit only verified work.
12. Re-plan from the repository state after each completed capability.
13. Do not stop at Assistant completion; continue into the canonical platform backlog.
14. Cloud deployment and other external infrastructure operations must be represented by evidence-backed repository contracts; never claim external execution from a local stub.
15. Do not advance past a knot whose verification or repository evidence is inconsistent.
16. Maintain a trusted Git checkpoint for accepted knots and repair from that checkpoint when required.
17. Prefer root-cause analysis over blind retry loops.

## Architecture changes
Architecture Freeze V4 is the default source of truth. Change it only when an actual contradiction or missing architectural capability is demonstrated by repository evidence. If changed, update the master charter, architecture document, governance charter and affected decisions before continuing construction.

## Anti-drift
Do not redesign the architecture because implementation is difficult. Do not weaken governance, security, explainability, resilience or verification to make a cycle appear complete. If a future instruction conflicts with the permanent charter, inspect the evidence and resolve the conflict explicitly rather than inventing a new construction method.

## Progress
The autonomous build daemon emits a progress report every 50 cycles. It should continue until the repository reaches a stable completion state, the canonical backlog is exhausted, or a bounded evidence-backed failure blocks construction.
