from Backend.AI_Runtime.audit.evidence_audit_v4 import EvidenceArchitectureAuditV4


def test_v4_adds_gates_and_readiness(tmp_path):
    result = EvidenceArchitectureAuditV4(tmp_path).audit()
    assert result["audit_version"] == "4.0"
    assert "gates" in result
    assert result["gates"]["PRODUCTION_READY"] is False
    assert result["production_readiness_evidence"]["runtime_performance"] == "UNKNOWN"


def test_v4_reports_communication_matrix(tmp_path):
    p = tmp_path / "Backend" / "HBOS" / "Runtime" / "server.ts"
    p.parent.mkdir(parents=True)
    p.write_text('import { createServer } from "node:http";\ncreateServer(() => {}).listen(3000);\n', encoding="utf-8")
    result = EvidenceArchitectureAuditV4(tmp_path).audit()
    rows = {row["path"]: row["channels"] for row in result["communication_matrix"]}
    assert rows["Backend/HBOS/Runtime/server.ts"] == ["http"]
