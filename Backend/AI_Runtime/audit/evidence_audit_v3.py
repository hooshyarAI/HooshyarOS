from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from Backend.AI_Runtime.audit.evidence_audit_engine import EvidenceArchitectureAudit


class EvidenceArchitectureAuditV3(EvidenceArchitectureAudit):
    """V3 refinement: elevate dependency cycles and layer semantics into root findings."""

    def audit(self) -> dict:
        result = super().audit()
        root_findings = list(result["findings"])

        for index, cycle in enumerate(result["dependency_graph"]["cycles"], start=1):
            root_findings.append({
                "id": f"ARCH-CYCLE-{index:03d}",
                "class": "ARCHITECTURE",
                "title": "Dependency cycle / strongly connected component",
                "severity": "HIGH" if len(cycle) <= 2 else "CRITICAL",
                "confidence": 0.95,
                "evidence_count": len(cycle),
                "sources": cycle,
                "disposition": "CONFIRMED_ARCHITECTURE_FINDING",
            })

        result["audit_version"] = "3.0"
        result["findings"] = sorted(
            root_findings,
            key=lambda item: (item["severity"] == "SIGNAL", -item["confidence"], item["id"]),
        )
        result["root_findings"] = result["findings"]
        result["architecture_semantics"] = self._layer_semantics(result)
        result["finding_summary"] = self._summary(result["findings"])
        return result

    def _layer_semantics(self, result: dict) -> dict:
        rows = {}
        for finding in result["findings"]:
            for source in finding.get("sources", []):
                if source.startswith("Backend/"):
                    parts = Path(source).parts
                    rows[source] = {
                        "declared_layer": next((p for p in parts if p in {
                            "Core", "Autonomous", "Product", "Commercial", "Security",
                            "Financial", "Engines", "Builder", "Runtime", "Architecture",
                            "Communication", "Persistence", "Factory", "Services"
                        }), "Other"),
                        "requires_semantic_review": finding["id"].startswith("ARCH-BOUND"),
                    }
        return rows

    def _summary(self, findings: list[dict]) -> dict:
        by_disposition = Counter(item.get("disposition", "UNKNOWN") for item in findings)
        by_class = Counter(item.get("class", "UNKNOWN") for item in findings)
        by_severity = Counter(item.get("severity", "UNKNOWN") for item in findings)
        return {
            "total_root_findings": len(findings),
            "by_disposition": dict(by_disposition),
            "by_class": dict(by_class),
            "by_severity": dict(by_severity),
        }

    def write_evidence(self, output: str | Path) -> dict:
        out = Path(output).resolve()
        out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "audit_v3.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        (out / "audit_v3_report.md").write_text(self._markdown_v3(result), encoding="utf-8")
        return result

    def _markdown_v3(self, result: dict) -> str:
        lines = [
            "# HooshyarOS Evidence-Based Architecture Audit V3",
            "",
            f"- HEAD: `{result['baseline']['head']}`",
            f"- Code files: **{result['inventory']['code_files']}**",
            f"- Lines: **{result['inventory']['lines']:,}**",
            f"- Dependency nodes: **{result['dependency_graph']['nodes']}**",
            f"- Dependency edges: **{result['dependency_graph']['edges']}**",
            f"- Cycles/SCC: **{len(result['dependency_graph']['cycles'])}**",
            f"- Root findings: **{len(result['findings'])}**",
            "",
            "## Root Findings",
            "",
        ]
        lines += [
            f"- **{item['severity']}** `{item['id']}` — {item['title']} "
            f"(confidence={item['confidence']:.2f}, evidence={item.get('evidence_count', 0)}, "
            f"disposition={item['disposition']})"
            for item in result["findings"]
        ]
        lines += ["", "## Summary", ""]
        for key, value in result["finding_summary"].items():
            lines.append(f"- {key}: `{value}`")
        lines += ["", "## Unknowns", ""]
        lines += [f"- {item}" for item in result["unknowns"]]
        return "\n".join(lines) + "\n"


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    result = EvidenceArchitectureAuditV3(args.repository).write_evidence(args.out)
    print(json.dumps({
        "status": "PASS",
        "audit_version": result["audit_version"],
        "head": result["baseline"]["head"],
        "cycles": len(result["dependency_graph"]["cycles"]),
        "root_findings": len(result["findings"]),
        "output": str(Path(args.out).resolve()),
    }, ensure_ascii=False, indent=2))
