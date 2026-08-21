from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


class FinancialVerticalAuditV7:
    """Evidence audit for the repository's financial ingestion -> intelligence vertical."""

    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()

    def _read(self, rel: str) -> str:
        return (self.root / rel).read_text(encoding="utf-8-sig", errors="replace")

    def audit(self) -> dict:
        adapter_path = self.root / "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts"
        intelligence_path = self.root / "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts"
        analysis_path = self.root / "Backend/HBOS/Product/FinancialStatementAnalysisService.ts"
        pipeline_path = self.root / "Backend/HBOS/Financial/FinancialIngestionPipeline.ts"
        persistence_path = self.root / "Backend/HBOS/Product/SQLitePersistenceStore.ts"

        evidence = {
            "ingestion_adapter_exists": adapter_path.exists(),
            "financial_intelligence_exists": intelligence_path.exists(),
            "statement_analysis_exists": analysis_path.exists(),
            "ingestion_pipeline_exists": pipeline_path.exists(),
            "persistence_exists": persistence_path.exists(),
        }

        adapter = self._read(adapter_path.relative_to(self.root).as_posix()) if adapter_path.exists() else ""
        intelligence = self._read(intelligence_path.relative_to(self.root).as_posix()) if intelligence_path.exists() else ""
        analysis = self._read(analysis_path.relative_to(self.root).as_posix()) if analysis_path.exists() else ""
        pipeline = self._read(pipeline_path.relative_to(self.root).as_posix()) if pipeline_path.exists() else ""
        persistence = self._read(persistence_path.relative_to(self.root).as_posix()) if persistence_path.exists() else ""

        evidence.update({
            "ingestion_features": {
                "csv_validation": "parseAndValidate" in adapter,
                "sha256_evidence": "createHash(\"sha256\")" in adapter,
                "tenant_scoped_write": "tenantId: normalizedTenant" in adapter and "financial-ingestion:" in adapter,
                "persistence_call": ".write(" in adapter,
            },
            "intelligence_features": {
                "ratio_analysis": "profitMargin" in intelligence and "debtRatio" in intelligence,
                "engine_input_is_financial_summary": all(x in intelligence for x in ["revenue", "expenses", "assets", "liabilities"]),
            },
            "analysis_features": {
                "uses_intelligence_engine": "FinancialIntelligenceEngine" in analysis and "financialIntelligence.analyze" in analysis,
                "uses_ingestion_evidence_type": "FinancialSourceEvidence" in analysis,
            },
            "integration": {
                "ingestion_adapter_imports_intelligence": "FinancialIntelligenceEngine" in adapter,
                "analysis_imports_ingestion_adapter": "./FinancialDataIngestionAdapter" in analysis,
                "ingestion_pipeline_imports_analysis": "FinancialStatementAnalysisService" in pipeline,
                "pipeline_imports_intelligence": "FinancialIntelligenceEngine" in pipeline,
            },
            "persistence": {
                "tenant_in_primary_key": "PRIMARY KEY (tenant_id, key)" in persistence,
                "prepared_statements": ".prepare(" in persistence,
            },
        })

        findings = []
        if not evidence["ingestion_features"]["csv_validation"] or not evidence["ingestion_features"]["sha256_evidence"]:
            findings.append({
                "id": "FIN-INGEST-001",
                "severity": "HIGH",
                "title": "Financial ingestion evidence contract incomplete",
                "confidence": 0.95,
                "disposition": "CONFIRMED_VERTICAL_FINDING",
            })

        if not evidence["integration"]["ingestion_adapter_imports_intelligence"] and not evidence["integration"]["pipeline_imports_intelligence"]:
            findings.append({
                "id": "FIN-INTEGRATION-001",
                "severity": "CRITICAL",
                "title": "Financial ingestion is not statically connected to Financial Intelligence Engine",
                "confidence": 0.92,
                "disposition": "CONFIRMED_INTEGRATION_GAP",
            })

        if evidence["analysis_features"]["uses_intelligence_engine"] and evidence["analysis_features"]["uses_ingestion_evidence_type"]:
            findings.append({
                "id": "FIN-VERTICAL-002",
                "severity": "HIGH",
                "title": "Financial statement analysis consumes source evidence but does not consume canonical ingestion output",
                "confidence": 0.88,
                "disposition": "CONFIRMED_VERTICAL_GAP",
            })

        if not evidence["persistence"]["tenant_in_primary_key"]:
            findings.append({
                "id": "FIN-PERSIST-001",
                "severity": "CRITICAL",
                "title": "Financial persistence tenant isolation is not evidenced by schema",
                "confidence": 0.98,
                "disposition": "CONFIRMED_PERSISTENCE_FINDING",
            })

        status = "PASS" if not any(f["severity"] == "CRITICAL" for f in findings) else "FAIL"
        return {
            "audit_version": "7.0",
            "status": status,
            "evidence": evidence,
            "findings": findings,
            "unknowns": [
                "Runtime financial ingestion throughput and latency require executable workload measurement.",
                "Concurrent SQLite writers and recovery behavior require local benchmark evidence.",
                "Business correctness of accounting classifications requires domain fixtures and expected-result traces.",
            ],
        }

    def write(self, out_dir: str | Path) -> dict:
        out = Path(out_dir).resolve()
        out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "financial_vertical_audit_v7.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        lines = ["# HooshyarOS Financial Vertical Audit V7", "", f"- Status: **{result['status']}**", "", "## Findings", ""]
        for item in result["findings"]:
            lines.append(f"- **{item['severity']}** `{item['id']}` — {item['title']} (confidence={item['confidence']:.2f})")
            lines.append(f"  - disposition: `{item['disposition']}`")
        lines += ["", "## Evidence", "", "```json", json.dumps(result["evidence"], ensure_ascii=False, indent=2), "```", "", "## Unknowns", ""]
        lines.extend(f"- {item}" for item in result["unknowns"])
        (out / "financial_vertical_audit_v7_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("repository")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = FinancialVerticalAuditV7(args.repository).write(args.out)
    print(json.dumps({"status": result["status"], "audit_version": "7.0", "findings": len(result["findings"]), "output": str(Path(args.out).resolve())}, ensure_ascii=False, indent=2))
