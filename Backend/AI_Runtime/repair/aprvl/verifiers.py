from __future__ import annotations

import json
from pathlib import Path

from .toolkit import Evidence, Finding, sha256


def verify_contract(root: Path, required: tuple[str, ...]) -> Evidence:
    findings: list[Finding] = []
    checks: list[str] = []
    for item in required:
        path = root / item
        checks.append(f"exists:{item}")
        if not path.exists():
            findings.append(Finding("contract", "required artifact missing", item, "ERROR"))
    digest = sha256(Path(__file__))
    return Evidence("contract-verifier", tuple(checks), tuple(findings), digest)


def verify_json(path: Path) -> Evidence:
    findings: list[Finding] = []
    checks = ("json-parse",)
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        findings.append(Finding("integrity", f"JSON verification failed: {exc}", str(path), "ERROR"))
    return Evidence("json-verifier", checks, tuple(findings), sha256(Path(__file__)))


def verified(evidence: Evidence) -> bool:
    return not any(f.severity == "ERROR" for f in evidence.findings)
