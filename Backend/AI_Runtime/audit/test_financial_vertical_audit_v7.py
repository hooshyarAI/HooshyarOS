from Backend.AI_Runtime.audit.financial_vertical_audit_v7 import FinancialVerticalAuditV7


def test_financial_vertical_detects_missing_static_integration(tmp_path):
    (tmp_path / "Backend/HBOS/Product").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Engines").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Financial").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts").write_text(
        'export class FinancialDataIngestionAdapter { ingestCsv() {} }', encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts").write_text(
        'export class FinancialIntelligenceEngine { analyze(x:any) { return x; } }', encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Product/FinancialStatementAnalysisService.ts").write_text(
        'import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";\n'
        'import { FinancialSourceEvidence } from "./FinancialDataIngestionAdapter";\n'
        'financialIntelligence.analyze(input);', encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Financial/FinancialIngestionPipeline.ts").write_text(
        'export class FinancialIngestionPipeline { ingest() {} }', encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Product/SQLitePersistenceStore.ts").write_text(
        'PRIMARY KEY (tenant_id, key); .prepare(', encoding="utf-8"
    )
    result = FinancialVerticalAuditV7(tmp_path).audit()
    ids = {item["id"] for item in result["findings"]}
    assert "FIN-INTEGRATION-001" in ids
    assert "FIN-VERTICAL-002" in ids


def test_financial_vertical_accepts_evidenced_tenant_persistence(tmp_path):
    (tmp_path / "Backend/HBOS/Product").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Engines").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Financial").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts").write_text(
        'createHash("sha256"); parseAndValidate(); this.persistence.write({ tenantId: normalizedTenant }, `financial-ingestion:${source.sha256}`, model);',
        encoding="utf-8",
    )
    (tmp_path / "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts").write_text(
        'revenue expenses assets liabilities profitMargin debtRatio', encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Product/FinancialStatementAnalysisService.ts").write_text(
        'import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";\n'
        'import { FinancialSourceEvidence } from "./FinancialDataIngestionAdapter";\n'
        'financialIntelligence.analyze(input);', encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Financial/FinancialIngestionPipeline.ts").write_text(
        'import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";', encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Product/SQLitePersistenceStore.ts").write_text(
        'PRIMARY KEY (tenant_id, key); .prepare(', encoding="utf-8"
    )
    result = FinancialVerticalAuditV7(tmp_path).audit()
    ids = {item["id"] for item in result["findings"]}
    assert "FIN-PERSIST-001" not in ids
