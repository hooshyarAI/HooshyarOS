from __future__ import annotations

import json
import re
from pathlib import Path

from Backend.AI_Runtime.audit.evidence_audit_v4 import EvidenceArchitectureAuditV4


ROUTE_RE = re.compile(r'url\.pathname\s*===\s*["\']([^"\']+)["\']')


class RuntimeContractAuditV5(EvidenceArchitectureAuditV4):
    """V5 validates the manifest-selected runtime against its actual HTTP surface."""

    def audit(self) -> dict:
        result = super().audit()
        contract = self._runtime_contract()
        result["runtime_contract"] = contract
        if contract["status"] != "PASS":
            finding = {
                "id": "RUNTIME-CONTRACT-001",
                "class": "RUNTIME",
                "severity": "CRITICAL",
                "confidence": 1.0,
                "title": "Canonical runtime contract is split or incomplete",
                "disposition": "CONFIRMED_RUNTIME_CONTRACT_FINDING",
                "evidence_count": len(contract["mismatches"]) + len(contract["parallel_runtime_servers"]),
                "evidence": contract,
            }
            result["findings"].append(finding)
            result["findings"] = sorted(
                result["findings"],
                key=lambda item: (item["severity"] == "SIGNAL", -item.get("confidence", 0), item["id"]),
            )
        result["gates"]["RUNTIME_CONTRACT_READY"] = contract["status"] == "PASS"
        if contract["status"] != "PASS":
            result["gates"]["BLOCKERS"] = list(dict.fromkeys(result["gates"]["BLOCKERS"] + ["RUNTIME-CONTRACT-001"]))
        result["gates"]["PRODUCTION_READY"] = False
        return result

    def _runtime_contract(self) -> dict:
        manifest_path = self.root / "product-manifest.json"
        if not manifest_path.exists():
            return {"status": "FAIL", "reason": "MANIFEST_MISSING", "mismatches": ["product-manifest.json"], "parallel_runtime_servers": []}
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        entrypoint = manifest.get("runtime", {}).get("entrypoint")
        health = manifest.get("runtime", {}).get("health")
        if not entrypoint:
            return {"status": "FAIL", "reason": "RUNTIME_ENTRYPOINT_MISSING", "mismatches": ["runtime.entrypoint"], "parallel_runtime_servers": []}

        canonical = self.root / entrypoint
        if not canonical.exists():
            return {"status": "FAIL", "reason": "CANONICAL_ENTRYPOINT_MISSING", "mismatches": [entrypoint], "parallel_runtime_servers": []}

        canonical_text = canonical.read_text(encoding="utf-8-sig", errors="replace")
        canonical_routes = sorted(set(ROUTE_RE.findall(canonical_text)))
        if health and health not in canonical_routes and health == "/health" and "/health" not in canonical_text:
            canonical_routes.append(health)

        servers = []
        for path in self.root.rglob("*CommercialRuntimeServer.ts"):
            if ".git" in path.parts:
                continue
            text = path.read_text(encoding="utf-8-sig", errors="replace")
            servers.append({"path": self._rel(path), "routes": sorted(set(ROUTE_RE.findall(text)))})

        parallel = [s for s in servers if s["path"] != entrypoint]
        expected_routes = sorted(set(canonical_routes + ([health] if health else [])))

        advertised = {"/health", "/api/ready", "/api/dashboard", "/api/session"}
        present_expected = sorted(advertised.intersection(set(canonical_routes)))
        missing_advertised = sorted(advertised - set(canonical_routes))

        mismatches = []
        if health and health not in canonical_text:
            mismatches.append(f"canonical health {health} not evidenced in entrypoint")
        if missing_advertised:
            mismatches.extend(f"canonical missing {route}" for route in missing_advertised)
        if parallel:
            mismatches.append("parallel CommercialRuntimeServer implementations exist")

        return {
            "status": "PASS" if not mismatches else "FAIL",
            "manifest_entrypoint": entrypoint,
            "manifest_health": health,
            "canonical_routes": expected_routes,
            "advertised_surface": sorted(advertised),
            "missing_advertised_routes": missing_advertised,
            "parallel_runtime_servers": parallel,
            "mismatches": mismatches,
        }

    def write_evidence(self, output: str | Path) -> dict:
        out = Path(output).resolve()
        out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "audit_v5.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        (out / "audit_v5_report.md").write_text(self._report(result), encoding="utf-8")
        return result

    def _report(self, result: dict) -> str:
        lines = [
            "# HooshyarOS Evidence-Based Architecture Audit V5",
            "",
            f"- HEAD: `{result['baseline']['head']}`",
            f"- Root findings: **{len(result['findings'])}**",
            f"- Runtime contract: **{result['runtime_contract']['status']}**",
            "",
            "## Runtime Contract",
            "",
            f"- Manifest entrypoint: `{result['runtime_contract']['manifest_entrypoint']}`",
            f"- Manifest health: `{result['runtime_contract']['manifest_health']}`",
            f"- Canonical routes: `{result['runtime_contract']['canonical_routes']}`",
            f"- Missing advertised routes: `{result['runtime_contract']['missing_advertised_routes']}`",
            f"- Parallel runtime servers: `{[x['path'] for x in result['runtime_contract']['parallel_runtime_servers']]}`",
            "",
            "## New Root Finding",
            "",
        ]
        for item in result["findings"]:
            if item["id"] == "RUNTIME-CONTRACT-001":
                lines.append(f"- **{item['severity']}** `{item['id']}` — {item['title']}")
                lines.append(f"  - disposition: `{item['disposition']}`")
                lines.append(f"  - evidence_count: `{item['evidence_count']}`")
        lines += ["", "## Gates", ""]
        lines += [f"- {k}: `{v}`" for k, v in result["gates"].items()]
        return "\n".join(lines) + "\n"


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = RuntimeContractAuditV5(args.repository).write_evidence(args.out)
    print(json.dumps({
        "status": "PASS",
        "audit_version": "5.0",
        "head": result["baseline"]["head"],
        "runtime_contract": result["runtime_contract"]["status"],
        "root_findings": len(result["findings"]),
        "output": str(Path(args.out).resolve()),
    }, ensure_ascii=False, indent=2))
