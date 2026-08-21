from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

GOVERNING_FILES = [
    "AGENTS.md",
    "Docs/HOOSHYAROS_MASTER_CHARTER.md",
    "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md",
    "Docs/ARCHITECTURE.md",
    "Assistant/SYSTEM_PROMPT.md",
    "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md",
    "Docs/Engineering/FAILURE_THEORY_GOVERNANCE_LAW.md",
]

RULES = {
    "one_capability_one_engine_one_test_one_commit": "One Capability = One Engine = One Test = One Commit",
    "python_first": "Python is the preferred implementation/orchestration worker",
    "checkpoint_before_risk": "trusted checkpoint",
    "repair_minimal": "minimal repair",
    "architecture_compliance": "architecture compliance",
    "failure_closed": "BLOCKED",
    "no_duplicate_engine": "duplicate engine",
}


def run_git(root: Path, *args: str) -> str:
    p = subprocess.run(["git", *args], cwd=root, text=True, capture_output=True, encoding="utf-8", errors="replace")
    return p.stdout.strip()


def audit(root: Path, target_ref: str | None, base_ref: str) -> dict:
    ref = target_ref or run_git(root, "branch", "--show-current")
    baseline = run_git(root, "rev-parse", base_ref)
    target_head = run_git(root, "rev-parse", ref)

    missing_governance = [p for p in GOVERNING_FILES if not (root / p).exists()]
    agents = (root / "AGENTS.md").read_text(encoding="utf-8", errors="replace") if (root / "AGENTS.md").exists() else ""

    changed = run_git(root, "diff", "--name-only", f"{base_ref}...{ref}").splitlines() if target_ref else []
    commits = run_git(root, "rev-list", "--count", f"{base_ref}..{ref}") if target_ref else "0"
    changed_tests = [p for p in changed if re.search(r"(^|/)(test|tests)/|\.(test|spec)\.", p, re.I)]
    changed_impl = [p for p in changed if p.endswith((".ts", ".tsx", ".js", ".py")) and p not in changed_tests]

    duplicate_registry = sorted(str(p.relative_to(root)).replace("\\", "/") for p in root.rglob("EngineRegistry.ts"))

    charter_presence = all(text in agents for text in RULES.values())
    finding = {
        "governance_docs_complete": not missing_governance,
        "charter_rules_present": charter_presence,
        "baseline": baseline,
        "target_ref": ref,
        "target_head": target_head,
        "changed_files": changed,
        "changed_implementation_files": changed_impl,
        "changed_test_files": changed_tests,
        "commit_count": int(commits or 0),
        "duplicate_engine_registry_count": len(duplicate_registry),
        "duplicate_engine_registry_paths": duplicate_registry,
    }

    violations: list[dict] = []
    if missing_governance:
        violations.append({"id": "GOV-001", "severity": "CRITICAL", "title": "Required governing artifacts missing", "evidence": missing_governance})
    if not charter_presence:
        violations.append({"id": "GOV-002", "severity": "HIGH", "title": "AGENTS.md does not contain required governing rules", "evidence": list(RULES)})
    if target_ref:
        if int(commits or 0) != 1:
            violations.append({"id": "GOV-003", "severity": "HIGH", "title": "Repair branch violates one-capability-one-commit transaction rule", "evidence": {"commits": int(commits or 0)}})
        if changed_impl and not changed_tests:
            violations.append({"id": "GOV-004", "severity": "HIGH", "title": "Implementation change has no focused verification change", "evidence": changed_impl})
        if len(changed_impl) > 3:
            violations.append({"id": "GOV-005", "severity": "MEDIUM", "title": "Repair scope exceeds minimal-change heuristic; neighbor review required", "evidence": changed_impl})

    return {
        "status": "FAIL" if violations else "PASS",
        "audit_version": "11.0",
        "target": finding,
        "violations": violations,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--target-ref")
    parser.add_argument("--base-ref", default="agent/release-final")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    root = Path(args.repository).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    result = audit(root, args.target_ref, args.base_ref)
    (out / "governance_compliance_audit_v11.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# HooshyarOS Governance Compliance Audit V11", "", f"- Status: **{result['status']}**", f"- Target: `{result['target']['target_ref']}`", f"- Base: `{result['target']['baseline']}`", "", "## Violations", ""]
    for v in result["violations"]:
        lines.append(f"- **{v['severity']}** `{v['id']}` — {v['title']}")
    (out / "governance_compliance_audit_v11_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
