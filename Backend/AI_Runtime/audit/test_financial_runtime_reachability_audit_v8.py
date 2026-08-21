from Backend.AI_Runtime.audit.financial_runtime_reachability_audit_v8 import FinancialRuntimeReachabilityAuditV8


def test_missing_financial_runtime_surface_is_detected(tmp_path):
    (tmp_path / "Backend/AI_Runtime").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Product").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Engines").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Financial").mkdir(parents=True)
    (tmp_path / "web").mkdir(parents=True)
    (tmp_path / "Backend/AI_Runtime/CommercialRuntimeServer.ts").write_text("if (req.url === '/health') {}", encoding="utf-8")
    (tmp_path / "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts").write_text("class FinancialDataIngestionAdapter {}", encoding="utf-8")
    (tmp_path / "Backend/HBOS/Product/FinancialStatementAnalysisService.ts").write_text("class FinancialStatementAnalysisService {}", encoding="utf-8")
    (tmp_path / "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts").write_text("class FinancialIntelligenceEngine {}", encoding="utf-8")
    (tmp_path / "Backend/HBOS/Financial/FinancialIngestionPipeline.ts").write_text("class FinancialIngestionPipeline {}", encoding="utf-8")
    (tmp_path / "web/app.js").write_text("fetch('/api/dashboard')", encoding="utf-8")

    result = FinancialRuntimeReachabilityAuditV8(tmp_path).audit()
    ids = {finding["id"] for finding in result["findings"]}
    assert "FIN-REACH-002" in ids
    assert "FIN-REACH-003" in ids


def test_financial_runtime_reference_removes_runtime_gap(tmp_path):
    (tmp_path / "Backend/AI_Runtime").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Product").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Engines").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Financial").mkdir(parents=True)
    (tmp_path / "web").mkdir(parents=True)
    (tmp_path / "Backend/AI_Runtime/CommercialRuntimeServer.ts").write_text(
        "FinancialStatementAnalysisService; if (req.url === '/api/financial') {}", encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts").write_text(
        "import { FinancialIntelligenceEngine } from '../Engines/FinancialIntelligenceEngine';", encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Product/FinancialStatementAnalysisService.ts").write_text("class FinancialStatementAnalysisService {}", encoding="utf-8")
    (tmp_path / "Backend/HBOS/Engines/FinancialIntelligenceEngine.ts").write_text("class FinancialIntelligenceEngine {}", encoding="utf-8")
    (tmp_path / "Backend/HBOS/Financial/FinancialIngestionPipeline.ts").write_text("class FinancialIngestionPipeline {}", encoding="utf-8")
    (tmp_path / "web/app.js").write_text("fetch('/api/financial')", encoding="utf-8")

    result = FinancialRuntimeReachabilityAuditV8(tmp_path).audit()
    ids = {finding["id"] for finding in result["findings"]}
    assert "FIN-REACH-002" not in ids
    assert "FIN-REACH-003" not in ids
