#!/usr/bin/env python3
"""Deterministic multi-agent audit and evidence-fusion engine for HooshyarOS.

This tool never treats Cursor, Claude Code, or Zapier output as truth. Their
reports are external evidence that is normalized and cross-checked against
the repository and Git state.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

EXCLUDED = {".git", "node_modules", ".venv", "venv", "dist", "build", "coverage"}
TEXT_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".py", ".md", ".json", ".yaml", ".yml"}
AUDITORS = ("python", "cursor", "claude-code", "zapier")


def norm(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def run_git(root: Path, *args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=root, text=True, stderr=subprocess.STDOUT).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def files(root: Path):
    for p in root.rglob("*"):
        if not p.is_file() or any(part in EXCLUDED for part in p.parts):
            continue
        if p.suffix.lower() in TEXT_EXTENSIONS:
            yield p


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def collect_repository_evidence(root: Path) -> dict[str, Any]:
    paths = [norm(p, root) for p in files(root)]
    docs = [p for p in paths if p.lower().startswith("docs/")]
    engines = sorted({p for p in paths if "/engines/" in p.lower() and p.endswith((".ts", ".md"))})

    roadmap_path = root / "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json"
    roadmap: dict[str, Any] = {}
    if roadmap_path.exists():
        try:
            roadmap = json.loads(read_text(roadmap_path))
        except json.JSONDecodeError:
            roadmap = {"_parse_error": True}

    capability_ids: list[str] = []
    if isinstance(roadmap.get("capabilities"), list):
        for item in roadmap["capabilities"]:
            if isinstance(item, dict) and isinstance(item.get("capabilityId"), str):
                capability_ids.append(item["capabilityId"])

    duplicate_ids = sorted(k for k, v in _duplicates(capability_ids).items() if len(v) > 1)
    return {
        "commit": run_git(root, "rev-parse", "HEAD"),
        "branch": run_git(root, "branch", "--show-current"),
        "status": run_git(root, "status", "--porcelain=v1", "--untracked-files=all"),
        "fileCount": len(paths),
        "documentationCount": len(docs),
        "engineArtifacts": engines,
        "capabilityIds": sorted(capability_ids),
        "duplicateCapabilityIds": duplicate_ids,
        "masterCharterPresent": (root / "Docs/HOOSHYAROS_MASTER_CHARTER.md").exists(),
        "architecturePresent": (root / "Docs/ARCHITECTURE.md").exists(),
        "governanceCharterPresent": (root / "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md").exists(),
    }


def _duplicates(values: list[str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = defaultdict(list)
    for value in values:
        result[value].append(value)
    return dict(result)


def load_external_reports(root: Path) -> list[dict[str, Any]]:
    evidence_dir = root / ".audit" / "evidence"
    reports: list[dict[str, Any]] = []
    if not evidence_dir.exists():
        return reports
    for auditor in AUDITORS:
        path = evidence_dir / f"{auditor}.json"
        if not path.exists():
            continue
        try:
            report = json.loads(read_text(path))
        except json.JSONDecodeError:
            report = {"auditor": auditor, "findings": [], "parseError": True}
        if not isinstance(report, dict):
            report = {"auditor": auditor, "findings": [], "invalidReport": True}
        report.setdefault("auditor", auditor)
        report.setdefault("findings", [])
        reports.append(report)
    return reports


def normalize_findings(reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for report in reports:
        auditor = str(report.get("auditor", "unknown"))
        for finding in report.get("findings", []):
            if not isinstance(finding, dict):
                continue
            key = str(finding.get("fingerprint") or finding.get("id") or finding.get("claim") or "unknown")
            group = groups.setdefault(key, {"fingerprint": key, "auditors": [], "findings": []})
            if auditor not in group["auditors"]:
                group["auditors"].append(auditor)
            group["findings"].append(finding)
    for group in groups.values():
        group["auditors"] = sorted(group["auditors"])
        group["independentSupport"] = len(group["auditors"])
        group["consensus"] = group["independentSupport"] >= 2
        group["conflict"] = len({json.dumps(f, sort_keys=True) for f in group["findings"]}) > 1
    return sorted(groups.values(), key=lambda item: item["fingerprint"])


def deterministic_findings(evidence: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    if not evidence["masterCharterPresent"]:
        findings.append({"id": "CHARTER_MISSING", "severity": "HIGH", "claim": "Master charter must exist"})
    if not evidence["architecturePresent"]:
        findings.append({"id": "ARCHITECTURE_DOC_MISSING", "severity": "HIGH", "claim": "Architecture contract must exist"})
    if not evidence["governanceCharterPresent"]:
        findings.append({"id": "GOVERNANCE_CHARTER_MISSING", "severity": "HIGH", "claim": "Governance charter must exist"})
    if evidence["duplicateCapabilityIds"]:
        findings.append({"id": "CAPABILITY_DUPLICATE", "severity": "HIGH", "claim": "Capability identifiers must be unique", "evidence": evidence["duplicateCapabilityIds"]})
    return findings


def build_audit(root: Path) -> dict[str, Any]:
    repo = collect_repository_evidence(root)
    external = load_external_reports(root)
    deterministic = deterministic_findings(repo)
    fused = normalize_findings(external)
    conflicts = [item for item in fused if item["conflict"]]
    return {
        "schema": "hooshyar.multi-agent-audit.v1",
        "auditors": list(AUDITORS),
        "authority": {
            "construction": ["python", "github", "assistant"],
            "audit": ["python", "cursor", "claude-code", "zapier"],
            "externalAuditorsAreNonAuthoritative": True,
        },
        "repository": repo,
        "deterministicFindings": deterministic,
        "externalReports": external,
        "fusedFindings": fused,
        "conflicts": conflicts,
        "status": "REVIEW_REQUIRED" if conflicts or deterministic else "CLEAN",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--out", default=".audit/multi-agent-audit.json")
    args = parser.parse_args()
    root = Path(args.repo).resolve()
    result = build_audit(root)
    output = root / args.out
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "commit": result["repository"]["commit"], "fusedFindings": len(result["fusedFindings"])}, ensure_ascii=False))
    return 0 if result["status"] in {"CLEAN", "REVIEW_REQUIRED"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
