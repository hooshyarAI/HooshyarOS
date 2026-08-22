"""Canonical autonomous master-cycle entrypoint.

The assistant is the orchestration boundary for construction, verification and
commercialization readiness. Domain implementation remains delegated to the
existing governed HBOS/AI workers; this file must not duplicate business logic.
"""
from __future__ import annotations

from autonomous_master_orchestrator import main


if __name__ == "__main__":
    raise SystemExit(main())
