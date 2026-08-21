from Backend.AI_Runtime.audit.evidence_audit_v3 import EvidenceArchitectureAuditV3


def test_cycles_become_root_findings(tmp_path):
    repo = tmp_path / "repo"
    a = repo / "Backend/HBOS/Autonomous/A.ts"
    b = repo / "Backend/HBOS/Autonomous/B.ts"
    a.parent.mkdir(parents=True, exist_ok=True)
    a.write_text('import { B } from "./B"; export class A {}\n', encoding="utf-8")
    b.write_text('import { A } from "./A"; export class B {}\n', encoding="utf-8")
    result = EvidenceArchitectureAuditV3(repo).audit()
    assert any(item["id"] == "ARCH-CYCLE-001" for item in result["findings"])


def test_v3_summary_exists(tmp_path):
    result = EvidenceArchitectureAuditV3(tmp_path).audit()
    assert result["audit_version"] == "3.0"
    assert "finding_summary" in result
    assert result["finding_summary"]["total_root_findings"] == len(result["findings"])
