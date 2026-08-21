from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

REQ = (
    "implementationPath",
    "testPath",
    "documentationPath",
)

class CapabilityMatrixAuditV12:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()

    def audit(self) -> dict:
        roadmap_path = self.root / "Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json"
        roadmap = json.loads(roadmap_path.read_text(encoding="utf-8"))
        findings = []
        capabilities = []
        for cap in roadmap.get("capabilities", []):
            item = {"capabilityId": cap.get("capabilityId"), "targetEngine": cap.get("targetEngine")}
            for key in REQ:
                rel = cap.get(key)
                item[key] = rel
                item[key + "Exists"] = bool(rel and (self.root / rel).exists())
            for dep in cap.get("dependencies", []):
                if not dep:
                    findings.append({"severity":"HIGH","id":"CAP-DEPENDENCY-001","capabilityId":item["capabilityId"],"message":"Empty capability dependency"})
            item["allArtifactEvidence"] = all(item[k + "Exists"] for k in REQ)
            if not item["allArtifactEvidence"]:
                findings.append({"severity":"HIGH","id":"CAP-ARTIFACT-001","capabilityId":item["capabilityId"],"message":"Capability lacks implementation, test, or documentation evidence"})
            capabilities.append(item)

        code_text = ""
        for p in self.root.rglob("*.ts"):
            if ".git" not in p.parts and "node_modules" not in p.parts:
                try: code_text += p.read_text(encoding="utf-8", errors="replace") + "\n"
                except OSError: pass
        for item in capabilities:
            impl = item.get("implementationPath") or ""
            stem = Path(impl).stem
            # Runtime reachability is intentionally conservative: only explicit canonical runtime references count.
            runtime_reachable = stem and re.search(re.escape(stem), code_text) is not None
            item["runtimeReferenceEvidence"] = bool(runtime_reachable)
            item["status"] = "ARTIFACTS_PRESENT_RUNTIME_REFERENCE_UNKNOWN" if item["allArtifactEvidence"] else "INCOMPLETE"

        return {
            "audit_version":"12.0",
            "roadmap_status": roadmap.get("status"),
            "capability_count": len(capabilities),
            "capabilities": capabilities,
            "findings": findings,
            "gates": {
                "artifact_completeness": not any(f["id"] == "CAP-ARTIFACT-001" for f in findings),
                "runtime_reachability": "MEASURE_REQUIRED",
                "architecture_compliance": "MEASURE_REQUIRED",
                "behavioral_verification": "MEASURE_REQUIRED",
                "production_ready": False,
            },
        }

    def write(self, out: str | Path) -> dict:
        out = Path(out).resolve(); out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "capability_matrix_v12.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        lines=["# HooshyarOS Capability Matrix Audit V12","",f"- Capability count: **{result['capability_count']}**","- Findings: **{len(result['findings'])}**","", "## Capabilities",""]
        for c in result["capabilities"]:
            lines.append(f"- `{c['capabilityId']}` — owner=`{c['targetEngine']}` — status=`{c['status']}` — artifacts={c['allArtifactEvidence']}")
        lines += ["","## Gates",""] + [f"- {k}: `{v}`" for k,v in result["gates"].items()]
        (out / "capability_matrix_v12_report.md").write_text("\n".join(lines)+"\n", encoding="utf-8")
        return result

if __name__ == "__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("repository"); ap.add_argument("--out", required=True); a=ap.parse_args()
    r=CapabilityMatrixAuditV12(a.repository).write(a.out)
    print(json.dumps({"status":"PASS","audit_version":"12.0","capability_count":r["capability_count"],"findings":len(r["findings"]),"output":str(Path(a.out).resolve())}, ensure_ascii=False, indent=2))
