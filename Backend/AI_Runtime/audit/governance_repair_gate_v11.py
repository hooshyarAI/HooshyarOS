from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


RULES = {
    "GOV-001": "Governance Charter + Architecture Freeze V4 are mandatory sources of truth before repair.",
    "GOV-002": "One Capability = One Engine = One Test = One Commit.",
    "GOV-003": "Reuse existing capability owners; do not introduce duplicate engine ownership.",
    "GOV-004": "Do not advance on an unverified knot; repair the same knot before continuing.",
    "GOV-005": "Repair must be minimal, architecture-compatible, evidence-backed, and followed by re-verification.",
    "GOV-006": "Failure Theory is fail-closed: missing/contradictory critical evidence blocks acceptance.",
    "GOV-007": "Repository/Git/runtime/tests are controlled construction evidence; runtime evidence outranks weaker evidence.",
}

REQUIRED_DOCS = [
    "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md",
    "Docs/ARCHITECTURE.md",
    "Assistant/SYSTEM_PROMPT.md",
    "Docs/Engineering/FAILURE_THEORY_GOVERNANCE_LAW.md",
]

class GovernanceRepairGateV11:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()

    def audit(self) -> dict:
        docs = {p: (self.root / p).exists() for p in REQUIRED_DOCS}
        charter = self._read("Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md")
        architecture = self._read("Docs/ARCHITECTURE.md")
        constitution = self._read("Assistant/SYSTEM_PROMPT.md")
        failure = self._read("Docs/Engineering/FAILURE_THEORY_GOVERNANCE_LAW.md")

        one_capability = "One Capability = One Engine = One Test = One Commit" in charter and "One Capability" in architecture
        duplicate_rule = "Never create a duplicate engine" in charter and "duplicate capability or engine ownership" in constitution
        minimal_repair = "MINIMAL REPAIR" in charter and "MINIMAL ARCHITECTURE-COMPATIBLE REPAIR" in constitution
        fail_closed = "fail-closed" in failure.lower() and "BLOCKED" in failure
        runtime_hierarchy = "Observed runtime/black-box evidence outranks integration evidence" in failure
        repair_loop = "DETECT →" in charter and "ROOT-CAUSE ANALYSIS" in constitution

        checks = {
            "governance_sources_present": all(docs.values()),
            "one_capability_owner_rule": one_capability,
            "duplicate_owner_prohibited": duplicate_rule,
            "minimal_repair_required": minimal_repair,
            "failure_theory_fail_closed": fail_closed,
            "runtime_evidence_priority": runtime_hierarchy,
            "root_cause_repair_loop": repair_loop,
        }

        missing = [k for k, v in checks.items() if not v]
        status = "PASS" if not missing else "BLOCKED"
        return {
            "audit_version": "11.0",
            "status": status,
            "governing_rules": RULES,
            "source_documents": docs,
            "checks": checks,
            "missing_controls": missing,
            "repair_acceptance_contract": {
                "owner": "required",
                "capability": "required",
                "strategy": "required",
                "focused_test": "required",
                "integration_verification": "required",
                "architecture_verification": "required",
                "failure_theory_assessment": "required",
                "runtime_evidence_for_runtime_changes": "required",
                "commit_after_verification": "required",
            },
        }

    def _read(self, rel: str) -> str:
        path = self.root / rel
        return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""

    def write(self, out: str | Path) -> dict:
        output = Path(out).resolve()
        output.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (output / "governance_repair_gate_v11.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        lines = ["# HooshyarOS Governance-Constrained Repair Gate V11", "", f"- Status: **{result['status']}**", ""]
        lines += ["## Controls", ""]
        lines += [f"- {k}: `{v}`" for k, v in result["checks"].items()]
        lines += ["", "## Missing Controls", ""]
        lines += [f"- `{m}`" for m in result["missing_controls"]] or ["- None"]
        lines += ["", "## Repair Acceptance Contract", ""]
        lines += [f"- {k}: `{v}`" for k, v in result["repair_acceptance_contract"].items()]
        (output / "governance_repair_gate_v11_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = GovernanceRepairGateV11(args.repository).write(args.out)
    print(json.dumps({"status": result["status"], "audit_version": result["audit_version"], "missing_controls": result["missing_controls"], "output": str(Path(args.out).resolve())}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
