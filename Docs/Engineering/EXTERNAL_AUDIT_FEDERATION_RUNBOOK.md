# External Audit Federation Runbook

**Governing document:** `Docs/Engineering/EXTERNAL_AUDIT_FEDERATION_CHARTER.md`

## Audit cycle

1. Freeze a trusted Git checkpoint.
2. Python performs deterministic repository/architecture audit.
3. Cursor performs an independent architecture/code challenge when available.
4. Claude Code performs an independent adversarial challenge when available.
5. Zapier routes audit events/evidence when available.
6. Python normalizes findings into a common evidence model.
7. Assistant performs expert correlation, contradiction analysis and priority selection.
8. Only evidence-backed defects enter the repair queue.
9. Repairs remain inside the canonical construction boundary.
10. Focused tests and integration verification run.
11. The same audit scope is re-run against the repaired checkpoint.
12. Evidence is committed before the next capability is selected.

## Finding severity

- P0: security, authorization, tenant isolation, data loss, corrupted state, invalid rollback, architecture-breaking contradiction.
- P1: incorrect capability ownership, broken dependency contract, incorrect decision logic, misleading completion evidence, production/commercial readiness defect.
- P2: maintainability, documentation drift, observability, performance or UX architecture issue.

## Required output

Every run produces an evidence record containing checkpoint, participants, availability, findings, disagreements, accepted repairs, rejected recommendations, verification results and final disposition.

## Important boundary

Cursor, Claude Code and Zapier are not invoked by the autonomous product runtime. They are external audit participants. Their output is advisory evidence until independently correlated and verified.
