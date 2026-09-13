# OrganizationalExecutionCoordinator

Canonical product capability: `product.organizational-execution`.

Target engine: Organizational Intelligence Engine

Capability: turn approved managerial decisions into governed workflows, assigned work and outcome evidence

Runtime entrypoints:

- `POST /api/execution/work-items` — propose a work item from the persisted decision artifact.
- `GET /api/execution/work-items` — list tenant-scoped work items.
- `GET /api/execution/work-items/:id` — read one tenant-scoped work item.
- `POST /api/execution/work-items/:id/approve` — human approval / governance gate.
- `POST /api/execution/work-items/:id/reject` — human rejection with reason.
- `POST /api/execution/work-items/:id/assign` — assign responsible actor + due date.
- `POST /api/execution/work-items/:id/start` — start execution.
- `POST /api/execution/work-items/:id/complete` — record KPI/outcome, evidence and feedback.
- `POST /api/execution/work-items/:id/block` — block with reason.
- `POST /api/execution/work-items/:id/cancel` — cancel with optional reason.

## Authority model (never collapsed)

| Authority | Owner |
|-----------|-------|
| Human decision recommendation | `DecisionWorkbench` / `DecisionIntelligenceEngine` |
| Human approval / governance gate | `OrganizationalExecutionCoordinator` + `GovernanceEngine` (`Authorization.APPROVE`) |
| Governed execution lifecycle | `OrganizationalExecutionCoordinator` |
| Autonomous execution | `AutonomousOperationsEngine` (separate; requires `AutonomousOperation` principal + `EXECUTE`) |

The governed path plans a workflow through `AutonomousOperationsEngine.planWorkflow`, but it never calls
`executeAuthorizedWorkflow` and it rejects autonomous principals on the human approval boundary. Human approval is
therefore never simulated by an autonomous actor.

## Composition (no duplicate engine)

- `GovernanceEngine` — approval authorization, tenant boundary, policy gate (`APPROVE_DECISION` → `APPROVE`).
- `AutonomousOperationsEngine` — governed `WorkflowPlan` (planning only; no autonomous execution).
- `OrganizationalIntelligenceEngine` — before/after learning evidence on completion (`learnFromExecution`).
- `KpiIntelligenceService` — KPI trend evidence when a series is provided.
- `SQLitePersistenceStore` — durable tenant-scoped work-item persistence and index.
- `ProvenanceTrace` — trace/hash provenance on every transition; `history` is the durable audit trail.

## Lifecycle and fail-closed rules

`AWAITING_APPROVAL → APPROVED → ASSIGNED → IN_PROGRESS → COMPLETED`, with `REJECTED`, `BLOCKED`, `CANCELLED`
side states. Invalid transitions return a `BLOCKED` result with code `INVALID_TRANSITION` and never mutate state.
Missing decision artifact, missing tenant, missing actor, missing permission, and autonomous principals all fail
closed. Tenant isolation is enforced on every read and write.

## Truthful boundary

The coordinator records governed human work and its outcome/evidence/feedback. It does not autonomously execute
enterprise systems and does not claim external integration execution.
