from __future__ import annotations

from pathlib import Path
from typing import Callable

from .contracts import RepairEvidence, RepairRequest, RepairResult


Detector = Callable[[RepairRequest], tuple[str, ...]]
Verifier = Callable[[RepairRequest, tuple[str, ...]], tuple[str, ...]]


class APRVLOrchestrator:
    """Governed Python execution boundary under HooshyarOS policy authority.

    APRVL can detect and verify, and can invoke an explicitly authorized action
    supplied by the platform. It cannot choose policy, grant authorization,
    disable gates, or manufacture verification evidence.
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
        return RepairResult("VERIFIED", evidence, "analysis-only verification")

    def execute_authorized(
        self,
        request: RepairRequest,
        action: Callable[[], bool],
        authorization_token: str,
    ) -> RepairResult:
        if not authorization_token or authorization_token != request.authorization_token:
            evidence = RepairEvidence("aprvl", (), (), False)
            return RepairResult("BLOCKED", evidence, "missing or invalid platform authorization")
        if not request.allowed_actions:
            evidence = RepairEvidence("aprvl", (), (), False)
            return RepairResult("BLOCKED", evidence, "no repair action was authorized")
        changed = bool(action())
        verification = self.verifier(request, self.detector(request))
        evidence = RepairEvidence("aprvl", (), verification, changed)
        if not verification:
            return RepairResult("BLOCKED", evidence, "post-repair verification failed")
        return RepairResult("VERIFIED", evidence, "authorized repair verified")
