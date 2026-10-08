# ACC ITEM — FIRST-CLASS NOTES & RECURRING WORKFLOWS

Status: **REQUIRES_ARCHITECTURE_CHANGE_CONTROL**
Date: 2026-09-27
Branch: `fix/autonomous-product-factory`
HEAD at authoring: `beb494e9`
Model: `deepseek/deepseek-flash` (no Pro model)
Author: Kilo (bounded execution layer) — no code change made for this item

## CURRENT STATE
Two workspace-continuity capabilities requested for the unified workspace are
**not** implemented because the existing governed execution architecture does not
own them and adding them would either mutate a frozen engine record or create a
new canonical owner:

1. **First-class notes.** The nearest existing concepts are
   `WorkItemFeedbackInput.notes` / `WorkItemFeedback.notes`
   (`OrganizationalExecutionCoordinator.ts`) — set only on completion — and
   ad-hoc `evidence[]` entries. There is no general, attachable note entity with
   its own lifecycle, author, edit/delete and audit.
2. **First-class recurring workflows.** `AutonomousOperationsEngine.planWorkflow`
   produces a one-shot `WorkflowPlan` stored as `OrganizationalWorkItem.workflow`.
   There is no recurrence/schedule/interval concept anywhere in `Backend/HBOS`
   (the only `recurrence` usage is `recurrenceCount`, a recurring *problem*
   learning metric in `OrganizationalProblemSolvingService.ts`).

Delivered safely instead (no ACC): tenant-scoped assistant conversation
continuity (`Product/AssistantConversationHistory.ts`, `GET /api/conversations`),
and a read-only remembrance/escalation projection over existing governed work
items (`GET /api/execution/attention`).

## CONFLICTING IMPLEMENTATION / CONSUMERS
- Extending `OrganizationalWorkItem` with a notes collection, or adding note
  transitions, mutates a **frozen** engine record (`Organizational Intelligence
  Engine` ownership) and every exact-record assertion in
  `OrganizationalExecutionRuntime.test.ts` and related suites.
- Recurring workflows require a **new canonical owner** (schedule/recurrence
  state, next-run materialisation, idempotency, tenant isolation, RBAC, audit).
  Creating that owner without an ACC would violate
  "one Capability = One Engine = One Test" and duplicate scheduling semantics.

## ARCHITECTURAL IMPACT
- Notes: adds a mutable, authored sub-entity to a frozen governed record.
- Recurring workflows: introduces a new persistent scheduling capability and a
  new engine/owner with its own lifecycle, error handling and audit, plus an
  interaction with the existing one-shot execution coordinator.

## PROPOSED TARGET (for governance decision — not executed)
1. **Notes:** prefer an additive `notes` collection on the work-item record with
   explicit `ADD_NOTE`/`EDIT_NOTE`/`DELETE_NOTE` transitions, author identity,
   tenant scope and history — implemented under ACC with migration of the frozen
   record tests. Alternative: a separate tenant-scoped note store linked by
   `workItemId` (no frozen-record change), if governance prefers zero mutation.
2. **Recurring workflows:** define a canonical recurrence owner
   (`product.recurring-workflows`) with: recurrence rule validation, next-run and
   catch-up semantics, idempotent materialisation into the existing
   `OrganizationalExecutionCoordinator`, tenant isolation, RBAC and audit. Specify
   stop conditions and bounded catch-up to avoid runaway generation.

## MIGRATION RISK
- Notes: Medium (frozen record + several runtime tests).
- Recurring workflows: High (new owner, scheduling correctness, idempotency and
  interaction with governed execution).

## TESTS REQUIRED BEFORE ACCEPTANCE
- Notes: add/edit/delete note lifecycle, author and tenant isolation, audit
  history, and reconfirmation of the frozen work-item record tests.
- Recurring workflows: rule validation, deterministic next-run computation,
  idempotent materialisation (no duplicate work items), bounded catch-up,
  tenant isolation, RBAC, and stop/cancel behaviour.

## REASON ACC IS REQUIRED
Notes mutate a frozen engine record; recurring workflows introduce a new canonical
owner and scheduling semantics. Neither may be created silently by the bounded
execution operator.

## DECISION
No change performed for notes or recurring workflows. Both are preserved for
Architecture Change Control; safe additive workspace continuity is delivered and
verified separately.
