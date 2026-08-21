from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from Backend.AI_Runtime.audit.evidence_audit_v3 import EvidenceArchitectureAuditV3


class EvidenceArchitectureAuditV4(EvidenceArchitectureAuditV3):
    """V4 adds capability evidence, communication contracts and root-cause typing."""

    def audit(self) -> dict:
        result = super().audit()
        result["audit_version"] = "4.0"
        result["capability_matrix"] = self._capability_matrix(result)
        result["communication_matrix"] = self._communication_matrix()
        result["root_cause_types"] = self._root_cause_types(result["findings"])
        result["production_readiness_evidence"] = self._production_readiness_evidence(result)
        result["gates"] = self._gates(result)
        return result

    def _capability_matrix(self, result: dict) -> dict:
        matrix = []
        for item in result.get("capabilities", []):
            implementation = item.get("implementation_candidates", [])
            tests = item.get("test_candidates", [])
            documentation = item.get("documentation_count", item.get("documentation_files", 0))
            matrix.append({
                "capability": item.get("capability"),
                "documentation": "PASS" if documentation else "UNKNOWN",
                "implementation": "PASS" if implementation else "UNKNOWN",
                "tests": "PASS" if tests else "UNKNOWN",
                "evidence_strength": round(
                    (bool(documentation) + bool(implementation) + bool(tests)) / 3, 2
                ),
                "implementation_candidates": implementation[:10],
                "test_candidates": tests[:10],
            })
        return matrix

    def _communication_matrix(self) -> list[dict]:
        channels = {
            "http": re.compile(r"\b(?:createServer|fetch|axios|http\.request|https\.request|listen)\b", re.I),
            "process": re.compile(r"\b(?:spawn|spawnSync|exec|execFile|fork)\b", re.I),
            "filesystem": re.compile(r"\b(?:readFile|readFileSync|writeFile|writeFileSync|mkdir|readdir|unlink)\b", re.I),
            "sqlite": re.compile(r"\b(?:DatabaseSync|sqlite|SQLitePersistenceStore|SQLiteIdentityStore)\b", re.I),
            "queue": re.compile(r"\b(?:queue|publish|consume|subscribe)\b", re.I),
        }
        rows = []
        for path in self._iter_files():
            if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"}:
                continue
            text = self._read(path)
            hits = [name for name, pattern in channels.items() if pattern.search(text)]
            if hits:
                rows.append({"path": self._rel(path), "channels": hits})
        return rows

    def _root_cause_types(self, findings: list[dict]) -> dict:
        counts = Counter()
        for finding in findings:
            if finding["id"].startswith("ARCH-CYCLE"):
                counts["DEPENDENCY_CYCLE"] += 1
            elif finding["id"] == "ARCH-REG-001":
                counts["DUPLICATE_OWNER"] += 1
            elif finding["id"].startswith("ARCH-BOUND"):
                counts["BOUNDARY_SEMANTICS"] += 1
            elif finding.get("class") == "SECURITY_SIGNAL":
                counts["SECURITY_SIGNAL"] += 1
            else:
                counts["OTHER"] += 1
        return dict(counts)

    def _production_readiness_evidence(self, result: dict) -> dict:
        return {
            "architecture": "BLOCKED" if any(
                f["severity"] in {"CRITICAL", "HIGH"} and f.get("class") == "ARCHITECTURE"
                for f in result["findings"]
            ) else "PASS",
            "capabilities": "PARTIAL" if any(
                row["evidence_strength"] < 1 for row in result["capability_matrix"]
            ) else "PASS",
            "communication": "MEASURE_REQUIRED",
            "runtime_performance": "UNKNOWN",
            "behavioral_verification": "MEASURE_REQUIRED",
            "security": "CONTEXT_REVIEW_REQUIRED" if any(
                f.get("class") == "SECURITY_SIGNAL" for f in result["findings"]
            ) else "PASS",
        }

    def _gates(self, result: dict) -> dict:
        architecture_blockers = [
            f["id"] for f in result["findings"]
            if f.get("class") == "ARCHITECTURE" and f["severity"] in {"CRITICAL", "HIGH"}
        ]
        return {
            "AUDIT_CLEAN": len(architecture_blockers) == 0,
            "ARCHITECTURE_READY": len(architecture_blockers) == 0,
            "PRODUCTION_READY": False,
            "PRODUCTION_READY_REASON": "Runtime performance and behavioral evidence are still unknown.",
            "BLOCKERS": architecture_blockers,
        }

    def write_evidence(self, output: str | Path) -> dict:
        out = Path(output).resolve()
        out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "audit_v4.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out / "audit_v4_report.md").write_text(self._report(result), encoding="utf-8")
        return result

    def _report(self, result: dict) -> str:
        lines = [
            "# HooshyarOS Evidence-Based Architecture Audit V4",
            "",
            f"- HEAD: `{result['baseline']['head']}`",
            f"- Code files: **{result['inventory']['code_files']}**",
            f"- Lines: **{result['inventory']['lines']:,}**",
            f"- Cycles: **{len(result['dependency_graph']['cycles'])}**",
            f"- Root findings: **{len(result['findings'])}**",
            "",
            "## Root Findings",
            "",
        ]
        lines += [
            f"- **{f['severity']}** `{f['id']}` — {f['title']} "
            f"(confidence={f.get('confidence', 0):.2f}, disposition={f.get('disposition', 'UNKNOWN')})"
            for f in result["findings"]
        ]
        lines += ["", "## Gates", ""]
        lines += [f"- {k}: `{v}`" for k, v in result["gates"].items()]
        lines += ["", "## Production Readiness Evidence", ""]
        lines += [f"- {k}: `{v}`" for k, v in result["production_readiness_evidence"].items()]
        lines += ["", "## Root Cause Types", ""]
        lines += [f"- {k}: **{v}**" for k, v in result["root_cause_types"].items()]
        return "\n".join(lines) + "\n"


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = EvidenceArchitectureAuditV4(args.repository).write_evidence(args.out)
    print(json.dumps({
        "status": "PASS",
        "audit_version": result["audit_version"],
        "head": result["baseline"]["head"],
        "root_findings": len(result["findings"]),
        "production_ready": result["gates"]["PRODUCTION_READY"],
        "output": str(Path(args.out).resolve()),
    }, ensure_ascii=False, indent=2))
