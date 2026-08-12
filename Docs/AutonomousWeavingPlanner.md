# Autonomous Weaving Planner

The AutonomousWeavingPlanner is the explicit planning layer used before autonomous construction execution.

## Contract

For every selected mission it records:

- the rationale for choosing and executing the current knot
- preconditions that must hold before tools run
- dependency order
- focused and integration verification order
- stop conditions
- deterministic risk classification

The planner does not invent capabilities or reorder the canonical backlog. Selection remains owned by the canonical mission and continuation contracts. The planner makes the selected action explicit and prevents execution when a construction precondition is violated.

## Weaving principle

One mission is one knot. The system plans the knot, verifies the surrounding threads, executes once, audits the result, and only then advances.
