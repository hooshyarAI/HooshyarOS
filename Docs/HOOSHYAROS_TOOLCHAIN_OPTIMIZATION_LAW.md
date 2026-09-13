# HooshyarOS Toolchain Optimization Law

**Status:** PERMANENT / GOVERNING / ANTI-DRIFT
**Scope:** Autonomous construction of HooshyarOS

## 1. Purpose

HooshyarOS must use the best available engineering method and approved tooling rather than manually recreating work that can be performed safely, deterministically and verifiably by the construction fabric.

The objective is **maximum correct throughput**, subject to architecture, security, governance, quality, explainability and evidence constraints.

## 2. Canonical construction toolchain

The construction path has three **principal authorities/roles**:

1. **Python** — canonical repository-native construction worker and orchestration layer for discovery, analysis, generation, verification, diagnosis, repair, evidence and re-planning.
2. **GitHub/Git** — repository state, trusted checkpoints, synchronization, commits, review and publication.
3. **This Assistant** — architecture reasoning, critical review, Expert Choice, architecture protection and construction orchestration.

**Approved execution operators are subordinate execution mechanisms, not additional architectural authorities.** Kilo Code is an approved local VS Code execution/operator layer. It may inspect the repository, execute bounded commands, apply governed implementation/repair changes, run focused tests and produce evidence when the active stage contract authorizes those actions.

Kilo Code does not replace Python as the canonical construction worker, does not become a provider dependency, and does not acquire authority over architecture, product semantics, backlog ordering, completion rules or governance.

TypeScript/Node remains the implementation technology wherever the frozen platform architecture requires it; Python is the canonical construction worker and orchestration layer, not a second product architecture.

## 3. Tool-first rule

Before asking the human owner to perform a mechanical development action, the construction fabric must determine whether Python, Git/GitHub, the Assistant or an approved execution operator can perform that action safely.

When an approved tool can perform the action, the Assistant must use that tool rather than delegating the mechanical work to the human.

The human is not an operator of the autonomous construction loop.

## 4. Python-first rule

Python must be the first-choice repository-native worker for autonomous construction tasks that are suitable for deterministic automation, including:

- repository auditing and discovery;
- capability detection and planning;
- deterministic code/test/document generation;
- static validation;
- test orchestration;
- failure diagnosis;
- bounded repair;
- evidence collection;
- construction telemetry;
- continuation and re-planning.

A task may use another repository-native implementation language only when the task itself belongs to that language's architectural boundary.

When Kilo Code executes a stage, it should prefer delegating deterministic repository-native generation, validation or repair to the Python worker rather than reproducing Python-owned logic inside the operator layer.

## 5. Reuse-before-build rule

The construction fabric must first inspect existing capabilities, engines, contracts, tests, documentation and history.

It must reuse an existing owner whenever the capability already belongs to an existing engine. It must not create a duplicate engine, duplicate capability owner or parallel implementation merely because generating a new file appears easier.

## 6. Human-intervention rule

Human intervention is reserved for:

- genuine product decisions;
- explicit architecture decisions;
- security/permission boundaries;
- unresolved contradictions in governing evidence;
- unavailable external resources;
- bounded failures that the construction fabric cannot safely repair.

Routine file editing, repetitive commands, standard verification, mechanical commits, ordinary recovery and capability advancement must remain autonomous whenever the approved toolchain can perform them safely.

## 7. Speed rule

Speed must come from better tooling, reuse, deterministic automation, proportional verification, bounded repair and safe parallelism—not from weakening tests, governance, architecture, security or evidence requirements.

Repeated blind retries and unnecessary full-suite verification are prohibited when risk-proportional verification is sufficient.

## 8. Repair rule

A failed knot must be repaired by the approved construction fabric from a trusted checkpoint. Repair identifiers such as `repair-<capabilityId>` are first-class construction intents and must remain intact across orchestration boundaries until the repair worker receives them.

An orchestration layer must never normalize a repair goal into the base capability before the repair worker executes.

Kilo Code repair execution is stage-bounded: it receives the exact handoff, repairs only the authorized target, produces focused evidence, and returns control to the outer Python/GitHub/Assistant verification flow.

## 9. Completion rule

A capability is complete only after implementation, verification, architecture compliance, repository evidence, commit and push agree.

Tool success, file existence or a generated artifact without evidence is not completion.

## 10. Operator contract

Approved execution operators such as Kilo Code must operate from an explicit stage/handoff contract. The contract must identify, at minimum:

- stage identifier and primary objective;
- exact target capability or repair intent;
- entry conditions and allowed scope;
- authoritative governing artifacts;
- focused verification required from the operator;
- stop conditions;
- evidence expected on return.

The operator may not silently widen scope. It must stop on architecture/governance contradiction, preserve failure evidence and return control to the canonical construction fabric.

## 11. Governance rule

Any future change to the construction method must preserve this law unless repository evidence demonstrates a genuine architectural contradiction. Such a change must update the governing repository memory and its verification before construction continues.
