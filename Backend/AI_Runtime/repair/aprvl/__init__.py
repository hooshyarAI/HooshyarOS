"""Autonomous Python Repair & Verification Layer (APRVL).

Python is an execution/evidence layer under HooshyarOS governance. It does not
make autonomous product decisions or bypass platform gates.
"""

from .contracts import RepairRequest, RepairEvidence, RepairResult
from .orchestrator import APRVLOrchestrator

__all__ = ["RepairRequest", "RepairEvidence", "RepairResult", "APRVLOrchestrator"]
