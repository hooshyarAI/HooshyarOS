from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


class FinancialRuntimeReachabilityAuditV8:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()

    def read(self, rel: str) -> str:
        path = self.root / rel
        return path.read_text(encoding="utf-8-sig", errors="replace") if path.exists() else ""

    def route_literals(self, text: str) -> set[str]:
        routes = set(re.findall(r"['\"](/api/[A-Za-z0-9_/?=&.-]+)['\"]", text))
        return {route.split("?", 1)[0] for route in routes}

    def audit(self) -> dict:
        runtime = self.read("Backend/AI_Runtime/CommercialRuntimeServer.ts")
        frontend = self.read("web/app.js")
        ingestion = self.read("Backend/HBOS/Product/FinancialDataIngestionAdapter.ts")
        analysis = self.read("Backend/HBOS/Product/FinancialStatementAnalysisService.ts")
        intelligence = self.read("Backend/HBOS/Engines/FinancialIntelligenceEngine.ts")
        pipeline = self.read("Backend/HBOS/Financial/FinancialIngestionPipeline.ts")

        runtime_routes = self.route_literals(runtime)
        frontend_routes = self.route_literals(frontend)
        findings = []

        if ingestion and intelligence and pipeline and analysis:
            if "FinancialIntelligenceEngine" not in ingestion:
                findings.append({
                    "severity": "CRITICAL",
                    "id": "FIN-REACH-001",
                    "title": "Financial ingestion cannot directly reach Financial Intelligence Engine",
                    "confidence": 0.97,
                    "disposition": "CONFIRMED_REACHABILITY_GAP",
                })

        financial_runtime_routes = sorted(
            route for route in runtime_routes | frontend_routes
            if any(token in route.lower() for token in ("financial", "ingest", "statement"))
        )
        if not financial_runtime_routes:
            findings.append({
                "severity": "CRITICAL",
                "id": "FIN-REACH-002",
                "title": "No financial ingestion or statement-analysis runtime route exposed",
                "confidence": 0.99,
                "disposition": "CONFIRMED_RUNTIME_REACHABILITY_GAP",
            })

        analysis_runtime_reference = any(
            token in runtime
            for token in (
                "FinancialStatementAnalysisService",
                "FinancialIntelligenceEngine",
                "FinancialDataIngestionAdapter",
            )
        )
        if not analysis_runtime_reference:
            findings.append({
                "severity": "HIGH",
                "id": "FIN-REACH-003",
                "title": "Canonical commercial runtime does not reference financial capability layer",
                "confidence": 0.96,
                "disposition": "CONFIRMED_RUNTIME_INTEGRATION_GAP",
            })

        return {
            "status": "PASS" if findings else "CLEAN",
            "audit_version": "8.0",
            "financial_runtime_routes": financial_runtime_routes,
            "canonical_runtime_routes": sorted(runtime_routes),
            "frontend_routes": sorted(frontend_routes),
            "evidence": {
                "ingestion_adapter_exists": bool(ingestion),
                "financial_intelligence_exists": bool(intelligence),
                "financial_analysis_exists": bool(analysis),
                "financial_pipeline_exists": bool(pipeline),
                "runtime_references_financial": analysis_runtime_reference,
            },
            "findings": findings,
        }

    def write(self, out: str | Path) -> dict:
        out_path = Path(out).resolve()
        out_path.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out_path / "financial_runtime_reachability_v8.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        lines = [
            "# HooshyarOS Financial Runtime Reachability Audit V8",
            "",
            f"- Status: **{result['status']}**",
            f"- Financial runtime routes: `{result['financial_runtime_routes']}`",
            "",
            "## Findings",
            "",
        ]
        for finding in result["findings"]:
            lines.append(
                f"- **{finding['severity']}** `{finding['id']}` — {finding['title']} "
                f"(confidence={finding['confidence']:.2f})"
            )
        (out_path / "financial_runtime_reachability_v8_report.md").write_text(
            "\n".join(lines) + "\n", encoding="utf-8"
        )
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = FinancialRuntimeReachabilityAuditV8(args.repository).write(args.out)
    print(json.dumps({
        "status": result["status"],
        "audit_version": result["audit_version"],
        "findings": len(result["findings"]),
        "output": str(Path(args.out).resolve()),
    }, ensure_ascii=False, indent=2))
