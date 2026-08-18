# HooshyarOS — Assistant Build Governance Law

**Status:** CANONICAL / MANDATORY  
**Scope:** All future repair, construction, productization, production-readiness, standardization, and commercial-release work.  
**Authority:** This law supplements the Canonical Refinement Plan and Assistant Platform Handoff. It does not permit bypassing existing architecture freezes, acceptance gates, or safety constraints.

## 1. Core Law

From this point forward, all implementation work for HooshyarOS MUST be executed through the platform's **Assistant Build System** and its authorized autonomous tooling.

The conversational AI assistant is **not** the implementation authority. It is an orchestrator, planner, diagnostician, and interface to the Assistant Build System. The Assistant Build System is the execution path.

The assistant MUST NOT silently replace the platform's builder, engines, missions, repair workers, acceptance gates, or autonomous workflow with ad-hoc code generation performed directly in the conversation.

## 2. Platform-Native Construction Principle

Every repair or new capability MUST first be expressed as a platform-native mission/capability and routed through the existing autonomous construction path.

The builder MUST preferentially reuse and compose existing:

- Engines
- Capabilities
- Missions
- Controllers
- Workers
- Policies
- Validators
- Memory/state mechanisms
- Recovery mechanisms
- Acceptance/completion gates
- Production-readiness mechanisms
- Existing architectural patterns and contracts

New infrastructure is permitted only when the existing platform cannot satisfy the requirement and the builder records the reason and architectural impact.

## 3. No Direct Cosmetic Implementation

A change is NOT considered implemented merely because:

- a file exists;
- a class exists;
- an interface exists;
- a method returns a plausible value;
- a unit test passes;
- a build succeeds;
- an installer is generated; or
- an API endpoint responds.

Implementation requires demonstrable runtime behavior and evidence that the capability performs its declared responsibility in the target environment.

## 4. Closed-Loop Prevention

The builder MUST NOT be the sole oracle for its own correctness.

For every capability, acceptance MUST combine independent evidence where applicable:

1. Static/type/lint validation.
2. Unit tests.
3. Integration tests against real component boundaries.
4. Runtime smoke/health verification.
5. Persistence verification for stateful behavior.
6. Security/dependency verification.
7. Packaging/install/uninstall verification for productization.
8. External-environment verification for production-critical behavior.
9. Contract tests whose expected behavior is derived from the capability contract rather than merely mirroring the implementation.

A generated test that only proves the implementation matches itself is insufficient evidence.

## 5. Evidence Before Acceptance

Every autonomous mission MUST produce an evidence record containing, at minimum:

- mission/capability identifier;
- baseline revision;
- intended behavior;
- files/components changed;
- commands/tools executed;
- independent validation results;
- runtime evidence where applicable;
- failures encountered;
- repairs performed;
- final acceptance decision;
- commit/revision identifier.

No claim of `READY`, `COMPLETE`, `PRODUCTION`, or `COMMERCIAL` may be emitted without corresponding evidence.

## 6. Commercialization Gate

HooshyarOS MUST NOT be declared commercially ready from source-code completion alone.

Commercial acceptance requires verification of the complete product path, including as applicable:

`build → package → install → initialize → start → runtime → persistence → API/UI → upgrade → recovery → uninstall`

A Windows installer is not considered operational merely because an `.exe` was produced. The installed runtime must actually start, remain alive for the intended desktop lifecycle, expose the required runtime endpoints, and survive the expected shell/browser lifecycle.

## 7. Real Environment Rule

Where behavior depends on an external system, the Assistant Build System MUST validate against that real system or a faithful independent test environment.

Examples include:

- PostgreSQL rather than an in-memory substitute for persistence claims;
- Redis rather than a dictionary pretending to be Redis;
- real HTTP/API boundaries for integration claims;
- real Windows installation/runtime lifecycle for Windows product claims;
- real dependency/security scanners for dependency claims.

A mock may validate an isolated unit contract, but MUST NOT be presented as proof of production integration.

## 8. Standardization Rule

When an established, maintained, well-understood standard component can safely satisfy a requirement, the builder SHOULD prefer it over creating a bespoke imitation.

Examples include standard database clients/ORMs, authentication systems, queues, caches, validation libraries, observability tooling, and security scanners.

The purpose is to reduce unnecessary code, repeated patterns, hidden maintenance burden, and false implementation surface.

## 9. Scope and Horizon Rule

The builder MUST work in bounded, verifiable increments.

Preferred unit of work:

`one capability → one bounded implementation → one independent contract set → one validation cycle → one acceptance decision → one commit`

Large speculative batches and mass generation of placeholder classes are prohibited.

## 10. Failure and Repair Rule

When validation fails, the builder MUST:

1. preserve the failure evidence;
2. classify the failure;
3. identify the smallest responsible boundary;
4. repair through the platform's autonomous repair mechanism;
5. rerun the relevant independent validations;
6. escalate to `BLOCKED` when the evidence cannot establish correctness.

It MUST NOT weaken, delete, or rewrite an acceptance test solely to make a failing mission pass.

## 11. No False Progress

The following are explicitly NOT progress metrics by themselves:

- file count;
- class count;
- test count;
- commit count;
- generated LOC;
- number of completed missions without runtime evidence.

The canonical progress metric is **verified capability value**: behavior that is implemented, integrated, executable, observable, and accepted against its contract.

## 12. Assistant Operating Rule

When the user asks to fix, build, standardize, productize, or commercialize HooshyarOS, the assistant MUST follow this sequence:

`Observe → Audit → Select smallest valuable capability → Form mission → Delegate to Assistant Build System → Execute → Independently verify → Repair → Re-verify → Accept → Commit → Record evidence → Continue`

The assistant MUST NOT skip directly from `Observe` to hand-written implementation when the Assistant Build System is available.

## 13. Human Responsibility Boundary

Autonomous construction is the default execution mechanism, but irreversible legal, security, financial, privacy, and customer-data decisions remain subject to the project's explicit human approval policy where required.

Automation MUST never manufacture human approval evidence.

## 14. Priority Rule

When speed conflicts with correctness, correctness wins.

When code volume conflicts with verified capability, verified capability wins.

When a local test conflicts with real runtime evidence, the real runtime evidence wins unless the test is proven to be the authoritative contract.

When an existing platform mechanism conflicts with ad-hoc implementation, the platform-native mechanism wins unless an explicit architectural exception is recorded.

## 15. Enforcement

This law is itself a build contract. The Assistant Build System MUST progressively enforce it through machine-checkable gates, mission policies, completion gates, CI workflows, and production acceptance checks.

The target state is not merely documentation saying that autonomous construction is preferred. The target state is that the repository makes non-compliant construction difficult or impossible to accept.

## 16. Canonical Definition of Done

A capability is `DONE` only when:

- its contract is explicit;
- its implementation is non-placeholder;
- its dependencies are real and wired;
- its state/persistence semantics are verified where required;
- its tests validate behavior independently of implementation shape;
- its runtime behavior is observed;
- its failure/recovery behavior is verified where required;
- its security/dependency posture is checked;
- its packaging/deployment path is verified where applicable;
- evidence is recorded;
- the Assistant Build System accepts the mission;
- the change is committed to the canonical development flow.

Anything less is `INCOMPLETE`, `BLOCKED`, or `UNVERIFIED` — never `PRODUCTION`.
