from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from Backend.AI_Runtime.audit.runtime_contract_audit_v5 import RuntimeContractAuditV5

FETCH_PATH_RE = re.compile(r"getJson\(\s*['\"]([^'\"]+)['\"]")
FETCH_DYNAMIC_RE = re.compile(r"fetch\(\s*['\"]([^'\"]+)['\"]")

class RuntimeContractAuditV6(RuntimeContractAuditV5):
    """V6 derives required runtime routes from the actual web client and tests them against the canonical server."""
    def audit(self) -> dict:
        result = super().audit()
        frontend = self._frontend_contract()
        result["frontend_contract"] = frontend
        mismatches = list(result["runtime_contract"].get("mismatches", []))
        canonical_routes = set(result["runtime_contract"].get("canonical_routes", []))
        missing_frontend = sorted(set(frontend["required_routes"]) - canonical_routes)
        if missing_frontend:
            mismatches.extend(f"frontend requires canonical route {route}" for route in missing_frontend)
        result["runtime_contract"]["frontend_required_routes"] = frontend["required_routes"]
        result["runtime_contract"]["frontend_missing_routes"] = missing_frontend
        if missing_frontend:
            result["runtime_contract"]["status"] = "FAIL"
            result["runtime_contract"]["mismatches"] = sorted(set(mismatches))
            result["runtime_contract"]["surface_contract_ok"] = False
            result["gates"]["RUNTIME_CONTRACT_READY"] = False
            if "RUNTIME-CONTRACT-001" not in result["gates"]["BLOCKERS"]:
                result["gates"]["BLOCKERS"].append("RUNTIME-CONTRACT-001")
        result["audit_version"] = "6.0"
        return result

    def _frontend_contract(self) -> dict:
        candidates = [self.root / "web" / "app.js"]
        app = next((p for p in candidates if p.exists()), None)
        if not app:
            return {"status":"UNKNOWN", "source":None, "required_routes":[]}
        text = app.read_text(encoding="utf-8-sig", errors="replace")
        routes = set(FETCH_PATH_RE.findall(text)) | set(FETCH_DYNAMIC_RE.findall(text))
        routes = {r.split("?",1)[0] for r in routes if r.startswith("/")}
        return {"status":"PASS", "source":app.relative_to(self.root).as_posix(), "required_routes":sorted(routes)}

    def write_evidence(self, output: str | Path) -> dict:
        out = Path(output).resolve(); out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "audit_v6.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        (out / "audit_v6_report.md").write_text(self._report(result), encoding="utf-8")
        return result

    def _report(self, result: dict) -> str:
        lines=[
            "# HooshyarOS Evidence-Based Architecture Audit V6", "",
            f"- HEAD: `{result['baseline']['head']}`",
            f"- Root findings: **{len(result['findings'])}**",
            f"- Runtime contract: **{result['runtime_contract']['status']}**",
            "", "## Frontend Contract", "",
            f"- Source: `{result['frontend_contract']['source']}`",
            f"- Required routes: `{result['frontend_contract']['required_routes']}`",
            f"- Missing from canonical runtime: `{result['runtime_contract'].get('frontend_missing_routes', [])}`",
            "", "## Runtime Contract", "",
            f"- Canonical routes: `{result['runtime_contract']['canonical_routes']}`",
            f"- Parallel runtime servers: `{[x['path'] for x in result['runtime_contract']['parallel_runtime_servers']]}`",
            f"- Surface contract OK: `{result['runtime_contract']['surface_contract_ok']}`",
            "", "## Gates", ""
        ]
        lines += [f"- {k}: `{v}`" for k,v in result["gates"].items()]
        return "\n".join(lines)+"\n"

if __name__ == "__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("repository"); parser.add_argument("--out", required=True); args=parser.parse_args()
    result=RuntimeContractAuditV6(args.repository).write_evidence(args.out)
    print(json.dumps({"status":"PASS","audit_version":"6.0","head":result["baseline"]["head"],"frontend_required_routes":result["frontend_contract"]["required_routes"],"frontend_missing_routes":result["runtime_contract"].get("frontend_missing_routes",[]),"runtime_contract":result["runtime_contract"]["status"],"output":str(Path(args.out).resolve())}, ensure_ascii=False, indent=2))
