from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class RepairRequest:
    capability: str
    problem: str
    evidence: dict[str, Any] = field(default_factory=dict)
    allowed_actions: tuple[str, ...] = ()
    authorization_token: str = ""


@dataclass(frozen=True)
class RepairEvidence:
    detector: str
    findings: tuple[str, ...]
    verification: tuple[str, ...]
    changed: bool
    digest: str = ""


@dataclass(frozen=True)
class RepairResult:
    status: str
    evidence: RepairEvidence
    reason: str = ""

    @property
    def accepted(self) -> bool:
        return self.status == "VERIFIED" and bool(self.evidence.verification)

    @property
    def mutation_allowed(self) -> bool:
        return bool(self.evidence.changed) and bool(self.evidence.verification)
