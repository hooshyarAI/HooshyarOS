# HooshyarOS Autonomous Engineering Contract

## Permanent governing charter
- `Docs/HOOSHYAROS_MASTER_CHARTER.md` — consolidated permanent master charter; read first and treat as non-optional.
- `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md` — permanent project construction governance.
- `Docs/ARCHITECTURE.md` — Architecture Freeze V4.
- `Assistant/SYSTEM_PROMPT.md` — autonomous construction constitution.
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

## Engineering rules
1. One capability = one coherent implementation contract + verification evidence.
2. One Capability = One Engine = One Test = One Commit.
3. Never create a duplicate engine when an existing engine owns the capability.
4. Prefer the smallest complete change that advances the frozen architecture.
5. Prefer repository-native tooling and Python workers for autonomous analysis, generation, verification and repair where useful.
6. External coding providers such as Codex, Copilot or Claude must never become hidden architectural dependencies.
7. Run static validation, focused tests and integration verification before finalizing.
8. If verification fails, diagnose and repair automatically within a bounded budget.
9. Preserve failure evidence; never fake a healthy result.
10. Keep internal contracts observable and recoverable.
11. Commit only verified work.
12. Re-plan from the repository state after each completed capability.
13. Do not stop at Assistant completion; continue into the canonical platform backlog.

## Architecture changes
Architecture Freeze V4 is the default source of truth. Change it only when an actual contradiction or missing architectural capability is demonstrated by repository evidence. If changed, update the master charter, architecture document, governance charter and affected decisions before continuing construction.

## Anti-drift
Do not redesign the architecture because implementation is difficult. Do not weaken governance, security, explainability, resilience or verification to make a cycle appear complete. If a future instruction conflicts with the permanent charter, inspect the evidence and resolve the conflict explicitly rather than inventing a new construction method.

## Progress
The autonomous build daemon emits a progress report every 50 cycles. It should continue until the repository reaches a stable completion state, the canonical backlog is exhausted, or a bounded evidence-backed failure blocks construction.
