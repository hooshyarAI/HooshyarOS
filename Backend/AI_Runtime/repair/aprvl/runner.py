from __future__ import annotations

import shlex
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from .contracts import RepairRequest
from .toolkit import Evidence, Finding, analyze_ci_log, dependency_closure, scan_repository


@dataclass(frozen=True)
class RepairPlan:
    actions: tuple[str, ...]
    rationale: tuple[str, ...]
    requires_governance: bool = True


class APRVLRunner:
    """High-level APRVL facade; orchestration/policy remains outside Python."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def detect(self, request: RepairRequest) -> tuple[Finding, ...]:
        findings = list(scan_repository(self.root))
        findings.extend(dependency_closure(self.root))
        ci_log = request.evidence.get("ci_log")
        if isinstance(ci_log, str):
            findings.extend(analyze_ci_log(ci_log))
        return tuple(findings)

    def plan(self, request: RepairRequest, findings: Sequence[Finding]) -> RepairPlan:
        # Python proposes executable actions only; the platform decides whether to authorize them.
        allowed = set(request.allowed_actions)
        candidates = tuple(f"inspect:{f.category}" for f in findings if f.category in allowed)
        return RepairPlan(candidates, tuple(f.message for f in findings), requires_governance=True)

    def evidence(self, request: RepairRequest, findings: Sequence[Finding]) -> Evidence:
        checks = ("repository-scan", "dependency-closure")
        if isinstance(request.evidence.get("ci_log"), str):
            checks += ("ci-log-analysis",)
        payload = "\n".join(f"{f.category}|{f.path}|{f.message}|{f.severity}" for f in findings)
        import hashlib
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return Evidence("aprvl", checks, tuple(findings), digest)

    @staticmethod
    def shell_preview(command: Sequence[str]) -> str:
        return shlex.join(command)
