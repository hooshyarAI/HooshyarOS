# HooshyarOS Autonomous Engineering Contract

## Permanent governing charter
- `Docs/HOOSHYAROS_MASTER_CHARTER.md` — consolidated permanent master charter; read first and treat as non-optional.
- `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md` — permanent project construction governance.
- `Docs/ARCHITECTURE.md` — Architecture Freeze V4.
- `Assistant/SYSTEM_PROMPT.md` — autonomous construction constitution.
- `Docs/AUTONOMOUS_WEAVING_DOCTRINE.md` — expert knot-by-knot construction and recovery doctrine.
- `Docs/AUTONOMOUS_7_DAY_BUILD_SLA.md` — permanent seven-day autonomous construction performance law.
- `Docs/HOOSHYAROS_TOOLCHAIN_OPTIMIZATION_LAW.md` — permanent tool-first, Python-first construction and human-intervention law.
- `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md` — canonical commercial-product completion and acceptance contract; mandatory for distinguishing canonical capability completion from real commercial product completion.
- `Docs/KILO_EXECUTION_OPERATOR_CONTRACT.md` — bounded Kilo Code execution/operator contract.
- Existing architecture decisions, HBOS engines, capability owners, tests and documentation — inspect before adding anything.

The repository is the durable memory of the approved architecture, product principles, autonomous-construction role, decision logic and verification rules. Do not rely on conversational memory when the repository can provide the governing rule.

## Role boundary
The autonomous Assistant builds HooshyarOS. It is not the future platform's financial, managerial or commercial advisor. Financial, managerial, organizational and operational intelligence define the product being constructed; they do not redefine the construction Assistant's role.

## Permanent two-command construction law
The complete autonomous construction experience must be operable from Visual Studio Code through exactly two human-triggered commands:

1. **Assistant Build Command** — starts/resumes autonomous construction of the HooshyarOS construction Assistant itself. From that point, Python is the first-choice worker for repository discovery, analysis, generation, verification, repair, orchestration, evidence collection and re-planning; the Assistant supplies architecture reasoning, critical review and Expert Choice; Git/GitHub supplies checkpoints, synchronization, commits, pushes and repository truth. Approved local execution operators such as Kilo Code may execute bounded stages under the stage contract; they do not replace Python or acquire architecture authority. The command must continue without routine human intervention until Assistant construction is verified complete or a bounded evidence-backed BLOCKED state is reached.
2. **Platform Build Command** — starts/resumes the canonical autonomous construction of the full HooshyarOS platform only after the Assistant completion gate and final Assistant verification have passed. It must continue automatically through the canonical backlog, preserving Architecture Freeze V4, governance, security, evidence and expert-weaving rules, until the canonical platform construction backlog is exhausted or a bounded evidence-backed BLOCKED state is reached.

No routine manual file editing or command-by-command driving is required between these two commands. Mechanical work that Python, Git/GitHub, the Assistant or an approved local execution operator can safely perform remains autonomous.

## Permanent seven-day completion law
The two-command construction system is subject to a **maximum seven-calendar-day target** for completing the canonical autonomous platform construction process from the approved starting state. The seven-day requirement is a performance constraint and never permits weakening architecture, security, governance, correctness, verification, recoverability or evidence integrity. The construction fabric must optimize throughput using reuse, Python-first automation, proportional verification, bounded repair, measurable telemetry and safe parallelism.

The seven-day objective applies to autonomous construction work governed by the repository backlog. It must explicitly distinguish Assistant construction complete, canonical autonomous platform construction complete, and full real-world production completion; the latter may require external resources or approvals and must never be falsely claimed.

## Autonomous execution
When assigned a build task, inspect the repository and existing Git history first. Derive the next genuinely missing capability from the master charter, governance charter, Architecture Freeze V4, current implementation state **and the Commercial Product Completion Contract**. Do not ask the human to provide file-by-file implementation instructions when the construction fabric can perform the work safely.

Use this loop:

Architecture → Decision → Capability → Tool Selection → Generate → Static Validation → Test → Integration Verification → Architecture Compliance → Repair → Re-test → Finalize → Commit → Push → Re-plan

When the Assistant completion gate is verified, immediately hand off to the canonical platform continuation flow:

AUDIT → SELECT NEXT GENUINELY MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → AUDIT AGAIN

### Commercial completion audit
Canonical capability backlog exhaustion is **not by itself** proof of commercial product completion. Before reporting `productComplete=true`, the builder must execute the commercial audit defined in `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md` and separately verify product runtime, persistence, identity, tenant isolation, data ingestion, API/application integration, dashboards/UI, reports, decision workflows, organizational execution, security, observability, installation/deployment and any other required commercial scope. External dependencies must be explicitly evidenced or reported as blocked.

### Seven-day performance law
The autonomous construction fabric is governed by a **seven-calendar-day target** for constructing the canonical HooshyarOS platform correctly and with production-grade engineering discipline.

This is a performance constraint, not permission to weaken correctness. All construction decisions must optimize:

**maximum correct throughput subject to architecture, quality, security, governance and verification constraints.**

Therefore the Assistant must actively remove unnecessary serialization, repeated full-suite verification, duplicate generation, false-negative capability detection, blind retry loops and avoidable human intervention. Independent work should be batched or parallelized when dependencies and repository isolation permit it. Verification should be proportional to risk: focused verification for local confidence, periodic integration checkpoints for system confidence, and deep audits when risk or evidence requires them.

The construction fabric must continuously measure generation, verification, repair and cycle time; completed capabilities per hour; retries; queue depth; blocking reasons; and cumulative backlog progress. The seven-day objective must be treated as an engineering constraint and optimized from measured evidence.

## Expert weaving contract
Every construction cycle follows the expert weaving doctrine:

```text
READ → UNDERSTAND → AUDIT → SELECT ONE KNOT → PLAN → CHECK DEPENDENCIES
→ SELECT STRATEGY → IMPLEMENT → TEST → VERIFY → CHECKPOINT → ADVANCE
```

A knot is one canonical capability with one owner, one intent, one implementation contract and one verification contract. Generation success alone is never sufficient evidence of acceptance.

### Capability evidence rule
Behavioral evidence is authoritative when it reflects the **actual owning Engine contract and the focused test contract**. Hard-coded method markers are hints only and must never be the sole source of truth for capability completion. The mission/audit layer must tolerate legitimate contract names such as `audit`, `analyze`, `validate`, `deploy`, `route`, or other repository-defined behavior without forcing a generic naming convention.

If a knot is wrong, incomplete or inconsistent, do not continue on top of it:

```text
DETECT FAILURE → IDENTIFY LAST TRUSTED CHECKPOINT → ROLLBACK / ISOLATE
→ ROOT-CAUSE ANALYSIS → REPAIR SAME KNOT → RE-VERIFY → RE-PLAN → CONTINUE
```

Repairs must be bounded, evidence-driven and architecture-preserving. A failed repair leaves the run BLOCKED with failure evidence intact.

## Construction tool policy
The construction process has three **principal authorities/roles**:

1. **Python** — canonical repository-native construction worker, analyzer, verifier, repair worker and orchestration layer.
2. **GitHub/Git** — source control, trusted checkpoints, synchronization, review and publication.
3. **This Assistant** — architecture reasoning, critical review, expert choice, implementation decisions and orchestration authority.

**Kilo Code is an approved local VS Code execution/operator layer subordinate to these authorities.** It may perform repository inspection, bounded implementation or repair, authorized command execution, focused testing and evidence production only within an explicit stage/handoff contract. Kilo Code does not replace the Python worker, does not become a provider dependency and has no authority over architecture, product semantics, backlog order, completion rules or governance.

No external cloud coding provider or alternative coding agent may participate as a hidden or mandatory construction dependency. Kilo Code is explicitly treated as a local execution mechanism under repository governance, not as a fourth architectural authority or provider runtime.

This restriction is operational, not architectural: the HooshyarOS product may still contain provider-facing runtime abstractions when the frozen architecture explicitly requires them, but the autonomous construction fabric itself must remain provider-independent.

## Engineering rules
1. One capability = one coherent implementation contract + verification evidence.
2. One Capability = One Engine = One Test = One Commit.
3. Never create a duplicate engine when an existing engine owns the capability.
4. Prefer the smallest complete change that advances the frozen architecture.
5. Use Python as the canonical construction worker and GitHub/Git as the durable repository control surface.
6. Use Kilo Code only as a bounded local execution/operator layer under its stage contract and the Python/Assistant orchestration boundary.
7. Run static validation, focused tests and integration verification before finalizing, using the risk-proportional cadence defined by the seven-day performance law.
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
18. Optimize the construction method continuously against the seven-day objective using measured throughput evidence.
19. Parallelize independent capabilities only when dependency contracts, repository isolation and deterministic integration remain safe.
20. Never trade architecture, security, governance, correctness or evidence integrity for apparent speed.
21. Derive behavioral completion evidence from actual Engine/Test contracts; marker lists may guide audits but cannot override the repository's real behavior.
22. Before delegating any mechanical development action to the human, prove that Python, Git/GitHub, the Assistant or an approved operator cannot safely perform it.
23. Preserve repair intent end-to-end; `repair-<capabilityId>` must reach the repair worker unchanged.
24. Use the best approved tool for each stage before considering additional human intervention.
25. Before declaring commercial product completion, pass the Commercial Product Completion Contract and keep external production dependencies distinct from repository-native completion.
26. When Kilo Code is selected, pass a structured handoff, keep the stage scope bounded, prefer Python for deterministic repository-native work, require focused evidence on return, and leave integration/qualification ownership with the outer construction fabric.

## Architecture changes
Architecture Freeze V4 is the default source of truth. Change it only when an actual contradiction or missing architectural capability is demonstrated by repository evidence. If changed, update the master charter, architecture document, governance charter and affected decisions before continuing construction.

## Anti-drift
Do not redesign the architecture because implementation is difficult. Do not weaken governance, security, explainability, resilience or verification to make a cycle appear complete. If a future instruction conflicts with the permanent charter, inspect the evidence and resolve the conflict explicitly rather than inventing a new construction method.

Kilo Code execution does not relax any of these requirements and cannot convert a stage-local execution failure into a completion claim.

## Progress
The autonomous build daemon must continuously emit measurable progress and throughput telemetry. It should continue until the repository reaches a stable completion state, the canonical backlog is exhausted, or a bounded evidence-backed failure blocks construction. Progress evaluation must include the seven-day performance constraint rather than merely counting successful test runs.

## Permanent toolchain optimization law
`Docs/HOOSHYAROS_TOOLCHAIN_OPTIMIZATION_LAW.md` is mandatory governing memory. It defines the Python-first/tool-first construction method, the bounded Kilo execution-operator role, human-intervention boundary, reuse-before-build rule, speed rule and preservation of repair intent across orchestration boundaries. Future autonomous cycles must read and obey it before construction.
