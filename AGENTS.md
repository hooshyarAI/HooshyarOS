# HooshyarOS Autonomous Engineering Contract

## Source of truth
- `Docs/ARCHITECTURE.md` â€” Architecture Freeze V4.
- `Assistant/SYSTEM_PROMPT.md` â€” development constitution and autonomous construction rules.
- Existing HBOS engines and capability owners â€” inspect before adding anything.

## Autonomous execution
When assigned a build task, inspect the repository and existing git history first. Derive the next missing capability from the final architecture and current implementation state. Do not ask the human to provide file-by-file instructions.

Use this loop:

Architecture â†’ Decision â†’ Plan â†’ Tool Selection â†’ Generate â†’ Static Validation â†’ Test â†’ Integration Verification â†’ Architecture Compliance â†’ Repair â†’ Re-test â†’ Finalize

## Engineering rules
1. One capability = one coherent implementation contract + verification evidence.
2. Never create a duplicate engine when an existing engine owns the capability.
3. Prefer the smallest complete change that advances the architecture.
4. Use repository-native tooling for implementation and Python for analysis/verification where useful.
5. Run tests and static validation before finalizing.
6. If verification fails, diagnose and repair automatically within a bounded budget.
7. Preserve failure evidence; never fake a healthy result.
8. Keep internal contracts observable and recoverable.
9. Commit only verified work.
10. Re-plan from the repository state after each completed capability.

## Architecture changes
Architecture Freeze V4 is the default source of truth. Change it only when an actual contradiction or missing architectural capability is demonstrated by repository evidence. If changed, update the architecture document and affected decisions before continuing construction.

## Progress
The autonomous build daemon emits a progress report every 50 cycles. It should continue until the repository reaches a stable completion state or a bounded failure blocks construction.
