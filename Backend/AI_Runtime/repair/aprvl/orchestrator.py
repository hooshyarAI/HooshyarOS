from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Callable

from .contracts import RepairEvidence, RepairRequest, RepairResult


Detector = Callable[[RepairRequest], tuple[str, ...]]
Verifier = Callable[[RepairRequest, tuple[str, ...]], tuple[str, ...]]


class APRVLOrchestrator:
    """Governed Python execution layer for repair analysis and verification.

    It never chooses a repair policy, disables gates, or reports success without
    verification evidence. Policy/engine selection remains in HooshyarOS.
    """

    def __init__(self, root: Path, detector: Detector, verifier: Verifier) -> None:
        self.root = root.resolve()
        self.detector = detector
        self.verifier = verifier

    def inspect(self, request: RepairRequest) -> RepairResult:
        findings = self.detector(request)
        verification = self.verifier(request, findings)
        evidence = RepairEvidence(
            detector="aprvl",
            findings=findings,
            verification=verification,
            changed=False,
        )
        if not verification:
            return RepairResult("BLOCKED", evidence, "verification evidence is insufficient")
        return RepairResult("VERIFIED", replace(evidence, changed=False), "analysis-only verification")
