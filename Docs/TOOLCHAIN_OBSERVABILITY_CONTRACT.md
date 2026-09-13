# HooshyarOS Toolchain Observability Contract

**Status:** Active construction rule
**Applies to:** Kilo Code, Python workers, verification workers and other approved autonomous execution operators
**Authority:** Subordinate to `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md`, `Docs/ARCHITECTURE.md` and `Assistant/SYSTEM_PROMPT.md`

## Purpose

Autonomous execution must be observable enough for the Assistant, auditors and operators to distinguish active work, failure, recovery and completion. A long-running opaque child process is not sufficient evidence of progress.

## Required behavior

An approved execution operator must, where the local runtime supports streaming:

1. emit a structured start event before execution;
2. stream operator output to the active construction console without buffering the entire run for human visibility;
3. preserve the streamed output as durable stage evidence;
4. emit a structured completion event containing exit status, duration and evidence-log location;
5. report failure explicitly and never convert missing output into success.

## Kilo Code

Kilo Code remains an execution/operator layer only. It may implement, test, repair, standardize and perform governed Git operations within the declared stage boundary. It does not own architecture, product semantics, governance or completion decisions.

For Windows autonomous execution, `KiloCodeExecutionAdapter` must provide live console visibility and a durable progress log while preserving the final result for the autonomous construction engine.

The Kilo model used by autonomous construction and repair is governed by repository configuration and must remain the verified free model unless an explicit repository governance decision changes that policy.

## Evidence contract

Human-visible progress is not by itself completion evidence. Stage completion still requires the existing construction contract: bounded scope, allowed artifact paths, focused verification, integration/behavioral evidence, clean repository state and trusted checkpointing.

Observability exists to make the stage state legible and recoverable; it does not weaken verification or completion rules.

## Recovery

If an operator is interrupted, the durable progress log and stage checkpoint are evidence for recovery. The system must resume from the most recent trusted checkpoint instead of relying on conversational memory or replaying already verified work.
