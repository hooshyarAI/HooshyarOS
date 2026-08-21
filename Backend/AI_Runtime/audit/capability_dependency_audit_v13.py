from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


class CapabilityDependencyAuditV13:
    version = "13.0"

    def __init__(self, repository: str):
        self.root = Path(repository).resolve()
        self.roadmap_path = self.root / "Docs" / "Product" / "PRODUCT_CONSTRUCTION_ROADMAP.json"
        self.architecture_path = self.root / "Docs" / "ARCHITECTURE.md"
        self.governance_path = self.root / "Docs" / "HOOSHYAROS_GOVERNANCE_CHARTER.md"

    def _roadmap(self) -> dict:
        return json.loads(self.roadmap_path.read_text(encoding="utf-8"))

    def _engine_names(self) -> set[str]:
        text = self.architecture_path.read_text(encoding="utf-8", errors="replace")
        candidates = {
            "Reasoning Engine", "Governance Engine", "Executive Intelligence Engine",
            "Organizational Intelligence Engine", "Autonomous Operations Engine",
            "Memory Engine", "Decision Engine", "Knowledge Engine", "Assistant Engine",
            "Project Pilot Engine", "Reaction Engine", "Health Monitor Engine",
        }
        normalized = text.lower().replace(" engine", "")
        return {name for name in candidates if name.lower().replace(" engine", "") in normalized}

    def _engine_artifact_exists(self, engine: str) -> bool:
        needle = re.sub(r"[^A-Za-z0-9]", "", engine).lower()
        for path in (self.root / "Backend" / "HBOS" / "Engines").glob("*.ts"):
            token = re.sub(r"[^A-Za-z0-9]", "", path.stem).lower()
            if needle in token or token in needle:
                return True
        return False

    def audit(self) -> dict:
        roadmap = self._roadmap()
        engines = self._engine_names()
        capabilities, findings = [], []

        for item in roadmap.get("capabilities", []):
            implementation = self.root / item["implementationPath"]
            test = self.root / item["testPath"]
            docs = self.root / item["documentationPath"]
            owner = item.get("targetEngine", "")
            deps = [
                {
                    "dependency": dep,
                    "architecture_named": dep in engines,
                    "artifact_present": self._engine_artifact_exists(dep),
                }
                for dep in item.get("dependencies", [])
            ]
            artifacts = {
                "implementation": implementation.exists(),
                "test": test.exists(),
                "documentation": docs.exists(),
            }
            owner_ok = owner in engines or self._engine_artifact_exists(owner)
            deps_ok = all(x["architecture_named"] and x["artifact_present"] for x in deps)
            artifact_ok = all(artifacts.values())
            allowed = owner_ok and deps_ok and artifact_ok

            if not owner_ok:
                findings.append({"id": "CAP-OWNER-001", "severity": "CRITICAL", "capabilityId": item["capabilityId"], "title": "Capability owner is not verifiably present in frozen architecture", "confidence": 0.94, "disposition": "BLOCKED_OWNER_RESOLUTION_REQUIRED"})
            if not deps_ok:
                findings.append({"id": "CAP-DEP-001", "severity": "HIGH", "capabilityId": item["capabilityId"], "title": "Capability dependency readiness is not satisfied", "confidence": 0.91, "disposition": "DEPENDENCY_ORDER_REQUIRED"})
            if not artifact_ok:
                findings.append({"id": "CAP-ARTIFACT-001", "severity": "HIGH", "capabilityId": item["capabilityId"], "title": "Capability artifacts are incomplete", "confidence": 1.0, "disposition": "CAPABILITY_INCOMPLETE"})

            capabilities.append({
                "capabilityId": item["capabilityId"], "owner": owner,
                "owner_verified": owner_ok, "dependencies": deps,
                "dependency_ready": deps_ok, "artifacts": artifacts,
                "artifact_complete": artifact_ok, "implementation_allowed": allowed,
                "runtime_reachability": "UNKNOWN", "behavioral_verification": "UNKNOWN",
                "production_ready": False,
            })

        return {
            "status": "PASS", "audit_version": self.version,
            "governance_present": self.governance_path.exists(),
            "architecture_present": self.architecture_path.exists(),
            "capability_count": len(capabilities), "findings": findings,
            "capabilities": capabilities,
        }

    def write(self, output: str | Path) -> dict:
        out = Path(output).resolve(); out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "capability_dependency_v13.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        (out / "capability_dependency_v13_report.md").write_text(self._report(result), encoding="utf-8")
        return result

    def _report(self, result: dict) -> str:
        lines = [
            "# HooshyarOS Capability Dependency / Owner Audit V13", "",
            f"- Capability count: **{result['capability_count']}**",
            f"- Findings: **{len(result['findings'])}**", "", "## Capabilities", "",
        ]
        for c in result["capabilities"]:
            lines.append(f"- `{c['capabilityId']}` — owner=`{c['owner']}` — owner_verified={c['owner_verified']} — dependency_ready={c['dependency_ready']} — artifact_complete={c['artifact_complete']} — implementation_allowed={c['implementation_allowed']}")
        lines += ["", "## Findings", ""]
        for f in result["findings"]:
            lines.append(f"- **{f['severity']}** `{f['id']}` — {f['capabilityId']} — {f['title']} (confidence={f['confidence']:.2f})")
        lines += ["", "## Gates", "", f"- governance_present: `{result['governance_present']}`", f"- architecture_present: `{result['architecture_present']}`"]
        return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("repository"); parser.add_argument("--out", required=True); args = parser.parse_args()
    result = CapabilityDependencyAuditV13(args.repository).write(args.out)
    print(json.dumps({"status": "PASS", "audit_version": "13.0", "capability_count": result["capability_count"], "findings": len(result["findings"]), "output": str(Path(args.out).resolve())}, ensure_ascii=False, indent=2))
