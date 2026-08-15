from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable


@dataclass(frozen=True)
class RepairAction:
    name: str
    description: str
    mutating: bool
    apply: Callable[[], bool]


class GovernedRepairer:
    """Executes only explicitly authorized, narrow repair actions.

    Authorization belongs to HooshyarOS governance; this class never infers permission.
    """

    def __init__(self, root: Path, allowed_actions: set[str]) -> None:
        self.root = root.resolve()
        self.allowed_actions = frozenset(allowed_actions)

    def execute(self, action: RepairAction) -> bool:
        if action.name not in self.allowed_actions:
            raise PermissionError(f"APRVL action not authorized: {action.name}")
        return bool(action.apply())

    def no_op(self, name: str = "verify-only") -> RepairAction:
        return RepairAction(name, "verification-only action; no mutation", False, lambda: True)
