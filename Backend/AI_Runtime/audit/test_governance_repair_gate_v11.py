from Backend.AI_Runtime.audit.governance_repair_gate_v11 import GovernanceRepairGateV11


def test_governance_repair_gate_accepts_release_baseline(tmp_path):
    for rel, text in {
        "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md": "One Capability = One Engine = One Test = One Commit\nNever create a duplicate engine\nMINIMAL REPAIR\nDETECT →",
        "Docs/ARCHITECTURE.md": "Architecture Freeze V4\nOne Capability",
        "Assistant/SYSTEM_PROMPT.md": "duplicate capability or engine ownership\nMINIMAL ARCHITECTURE-COMPATIBLE REPAIR\nROOT-CAUSE ANALYSIS",
        "Docs/Engineering/FAILURE_THEORY_GOVERNANCE_LAW.md": "GOVERNING / FAIL-CLOSED\nBLOCKED\nObserved runtime/black-box evidence outranks integration evidence",
    }.items():
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    result = GovernanceRepairGateV11(tmp_path).audit()
    assert result["status"] == "PASS"
    assert result["missing_controls"] == []


def test_governance_repair_gate_blocks_missing_governance(tmp_path):
    result = GovernanceRepairGateV11(tmp_path).audit()
    assert result["status"] == "BLOCKED"
    assert "governance_sources_present" in result["missing_controls"]
