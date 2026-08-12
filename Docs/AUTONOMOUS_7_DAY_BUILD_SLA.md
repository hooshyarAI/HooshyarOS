# Autonomous 7-Day Build Law

**Status:** PERMANENT / GOVERNING / PERFORMANCE CONSTRAINT
**Applies to:** HooshyarOS Autonomous Construction Fabric
**Architecture baseline:** Architecture Freeze V4

## 1. Non-negotiable construction objective

The HooshyarOS Autonomous Assistant must be engineered and operated as a high-leverage construction instrument whose purpose is to reduce the time required to reach a correct, integrated, executable HooshyarOS platform by orders of magnitude.

**Target construction window: seven calendar days.**

Seven days is a governing performance constraint for the autonomous construction method. It is not permission to weaken architecture, security, governance, verification, correctness, recoverability or product evidence.

## 2. Optimization law

Every autonomous construction decision must optimize for:

**maximum correct throughput subject to architecture, quality, security, governance and verification constraints.**

A construction step that is locally correct but unnecessarily serial, repetitive, or verification-heavy must be redesigned when repository evidence shows a safer higher-throughput strategy.

The Assistant must never treat slow human-style iteration as the default operating model.

## 3. Required operating behavior

The construction fabric must continuously:

1. derive the complete remaining work from the canonical architecture and backlog;
2. build a dependency graph and identify independent work;
3. batch or parallelize independent construction where safe;
4. use focused verification for local confidence;
5. reserve deep/full integration verification for explicit risk or periodic checkpoints;
6. checkpoint verified progress continuously;
7. detect and repair failures without unnecessary rollback of unrelated verified work;
8. measure construction throughput and bottlenecks;
9. adapt the construction strategy from measured evidence;
10. continue autonomously until the canonical construction backlog is exhausted or an evidence-backed BLOCKED state is reached.

## 4. Verification-speed rule

Verification is a control mechanism, not the destination.

The Assistant must not execute the most expensive repository-wide verification after every small independent capability unless risk, dependency impact or policy requires it.

The default should be:

**focused verification → periodic integration verification → risk-triggered deep audit**

The exact cadence must remain configurable and evidence-driven.

## 5. Parallel construction rule

Independent capabilities may be constructed concurrently only when:

- their dependency contracts are already satisfied;
- they do not share an unsafe mutable construction surface;
- each worker has isolated repository/worktree state;
- merge/integration order is deterministic;
- verification evidence remains attributable to the correct capability owner.

Parallelism must never create ambiguous ownership, hidden conflicts or unverified composite states.

## 6. Throughput telemetry

The construction fabric must observe at least:

- generation time;
- verification time;
- repair time;
- cycle time;
- capabilities completed per hour;
- retry/repair frequency;
- queue depth;
- blocking reasons;
- percentage of time spent in construction versus verification;
- cumulative progress toward the canonical backlog.

Optimization must be based on measured repository evidence rather than intuition alone.

## 7. Anti-patterns prohibited by this law

The following are considered construction defects when they materially prevent the seven-day objective without a corresponding safety or correctness reason:

- running the full repository test suite after every independent knot;
- repeatedly rebuilding a capability already proven complete;
- blind retry loops;
- serializing independent work without a dependency reason;
- rechecking unchanged evidence unnecessarily;
- waiting for human intervention for mechanical repository work;
- allowing a false-negative capability audit to repeatedly trigger repair;
- spending more time validating an unchanged subsystem than constructing new verified capability.

## 8. Safety override

The seven-day constraint never authorizes the Assistant to:

- bypass architecture ownership;
- weaken security or governance;
- suppress failure evidence;
- fake tests or verification;
- mark an incomplete capability as complete;
- overwrite trusted work without recovery evidence;
- claim production completion without production evidence.

When speed and correctness conflict, correctness wins. When the current method is both correct and unnecessarily slow, the method must be optimized.

## 9. Completion semantics

The seven-day target applies to the autonomous construction objective described by the repository's canonical backlog and does not by itself assert real-world production deployment, third-party approvals, customer acceptance or external infrastructure readiness.

The Assistant must explicitly distinguish:

- Assistant construction complete;
- canonical autonomous platform construction complete;
- full production product complete.

## 10. Construction mantra

**Build like an aircraft, not like a person walking the route.**

**Use the map once, then exploit it continuously.**

**Parallelize what can be parallelized.**

**Verify proportionally to risk.**

**Measure throughput.**

**Repair root causes, not symptoms.**

**Preserve quality while removing unnecessary waiting.**

**The seven-day objective is a governing performance constraint.**
