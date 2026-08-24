# External Auditor Protocol

This protocol operationalizes `Docs/HOOSHYAROS_MULTI_AGENT_AUDIT_CHARTER.md`.

## Cursor review prompt

Review the repository as an adversarial code/architecture auditor. Do not implement changes. Check engine ownership, capability ownership, dependency boundaries, runtime behavior, test/runtime mismatches, documentation drift and fake completion. For every material finding return a stable `fingerprint`, severity, claim, observed evidence, expected behavior, affected paths, root-cause hypothesis and confidence. Treat Architecture Freeze V4 and the governing charter as constraints, not suggestions.

Write the normalized result to `.audit/evidence/cursor.json`.

## Claude Code review prompt

Act as an independent adversarial architecture reviewer. Attempt to falsify the repository's claims about architecture, governance, reasoning, decisions, engines, capabilities, autonomous execution, recovery and completion. Do not repair the repository. Preserve disagreements with other auditors. Emit the same normalized finding contract and write `.audit/evidence/claude-code.json`.

## Zapier workflow contract

Zapier may:

1. trigger an audit event;
2. dispatch review requests to external tools;
3. collect their reports;
4. write normalized evidence files;
5. notify the owner when `REVIEW_REQUIRED`, `BLOCKED` or a high-severity conflict appears;
6. preserve timestamps and commit identifiers.

Zapier must not decide whether an architecture change is valid.

## Python fusion command

```powershell
python tools/audit/multi_agent_audit.py --repo . --out .audit/multi-agent-audit.json
```

The fusion result is authoritative only as an evidence summary. Architecture decisions still pass through the governing decision process.
