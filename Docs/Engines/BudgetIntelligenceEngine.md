# Budget Intelligence Engine

Canonical autonomous capability: `platform.budget-intelligence`.

Capability: implement Budget Intelligence

Dependencies: Financial Intelligence Engine

## Architecture contract
- Architecture Freeze V4
- One Capability = One Engine
- Engine must be observable
- Engine must be testable
- Engine must be recoverable
- No duplicate capability owner

## Construction directives
- Implement exactly one concrete capability from the canonical mission.
- Create or update the focused implementation, focused test and documentation required by the architecture.
- Run focused verification followed by the full Jest suite.
- Repair verification failures before finalization.
- Do not redesign Architecture Freeze V4.

This scaffold is intentionally semantic-neutral. The autonomous construction loop
must enrich it only from repository architecture, dependencies, tests and evidence;
it must not invent business rules or create duplicate engine boundaries.
