# Kilo Code Execution Operator Contract

**Status:** ACTIVE / GOVERNED / STAGE-BOUNDED
**Architecture baseline:** Architecture Freeze V4

## Purpose

Kilo Code is an approved local VS Code execution/operator layer for HooshyarOS autonomous construction. It is not an architectural owner, construction provider, product runtime dependency or source-of-truth authority.

## Role separation

Python is the canonical repository-native construction worker and orchestration layer. It owns deterministic discovery, generation, validation, repair orchestration, evidence preparation and re-planning.

**Kilo Code** is the bounded local execution operator. It may inspect repository state, execute authorized commands, make scoped implementation/repair edits, run focused verification and return evidence.

**Git/GitHub** is the durable repository/checkpoint surface.

**This Assistant** owns architecture reasoning, critical review, Expert Choice and orchestration authority.

## Authority boundary

Kilo Code MUST NOT redefine or bypass:

- Architecture Freeze V4;
- governance or source-of-truth hierarchy;
- canonical engine ownership;
- product semantics;
- canonical backlog order;
- completion/acceptance rules;
- security, evidence or checkpoint requirements.

An operator prompt, model preference, local memory or configuration cannot override repository governance.

## Python ↔ Kilo handoff

Every governed operator execution should carry an explicit handoff containing:

1. stage identifier;
2. objective;
3. exact capability/repair intent;
4. entry conditions;
5. allowed scope;
6. authoritative repository rules;
7. focused verification contract;
8. stop conditions;
9. expected evidence;
10. trusted base/checkpoint.

Kilo should prefer the existing Python worker for deterministic repository-native generation, validation or repair logic rather than duplicating that logic in Kilo.

Kilo may perform direct edits when the stage contract explicitly authorizes them and the change is the smallest coherent repair or implementation within scope.

Repair identifiers such as `repair-<capabilityId>` must pass unchanged from planning/orchestration to the operator handoff.

## Verification and return protocol

The default operator lifecycle is:

**READ → AUDIT HANDOFF → EXECUTE ONE STAGE → FOCUSED TEST → REPORT EVIDENCE → RETURN CONTROL**

The outer construction fabric owns integration verification, broader acceptance, checkpointing, commit/push and continuation unless the stage contract explicitly assigns those operations.

Kilo must stop and return failure evidence when:

- scope would need to expand;
- a dependency is unexpectedly invalid;
- a governance/architecture contradiction is discovered;
- verification cannot establish the requested contract;
- the bounded repair budget is exhausted.

## Performance

Kilo and Python should minimize repeated repository-wide work. Use focused verification for local changes and reserve full-suite or deep audit work for the outer integration/qualification flow or for risk that requires it.

The optimization target is **maximum correct throughput**, never maximum apparent throughput.
