# Organizational Intelligence Engine

Canonical autonomous capability: `repair-product.organizational-execution`.

Capability: repair commercial quality failure for product.organizational-execution: turn approved managerial decisions into governed workflows, assigned work and outcome evidence

Dependencies: Organizational Intelligence Engine, Governance Engine, Autonomous Operations Engine

## Architecture contract
- Architecture Freeze V4
- One Capability = One Engine
- Engine must be observable
- Engine must be testable
- Engine must be recoverable
- No duplicate capability owner
- Generated artifacts must stay inside the declared capability boundary

## Construction directives
- Implement exactly one concrete capability from the canonical mission.
- Create or update the focused implementation, focused test and documentation required by the architecture.
- Run focused verification for the selected knot
- run Autonomous Builder tests periodically
- run the full Jest suite only at the periodic integration checkpoint.
- Repair verification failures before finalization.
- Do not redesign Architecture Freeze V4.
- Never modify an existing dependency, engine, test or document merely to make the selected capability appear implemented.
- For a product capability, implement the product artifact paths declared by the durable product roadmap
- do not substitute the target engine as the implementation artifact.

This scaffold is intentionally semantic-neutral. The autonomous construction loop
must enrich it only from repository architecture, dependencies, tests and evidence;
it must not invent business rules or create duplicate engine boundaries.
