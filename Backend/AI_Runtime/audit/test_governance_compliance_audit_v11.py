from pathlib import Path

from Backend.AI_Runtime.audit.governance_compliance_audit_v11 import audit


def test_governance_audit_accepts_clean_single_commit_shape(tmp_path: Path, monkeypatch):
    # Unit-level contract: required governance files must be recoverable from repository.
    for name in [
        "AGENTS.md",
        "Docs/HOOSHYAROS_MASTER_CHARTER.md",
        "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md",
        "Docs/ARCHITECTURE.md",
        "Assistant/SYSTEM_PROMPT.md",
        "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md",
        "Docs/Engineering/FAILURE_THEORY_GOVERNANCE_LAW.md",
    ]:
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("governance placeholder", encoding="utf-8")
    (tmp_path / "AGENTS.md").write_text(
        "One Capability = One Engine = One Test = One Commit\n"
        "Python is the preferred implementation/orchestration worker\n"
        "trusted checkpoint\nminimal repair\narchitecture compliance\nBLOCKED\nduplicate engine\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(
        "Backend.AI_Runtime.audit.governance_compliance_audit_v11.run_git",
        lambda root, *args: "base" if args[:2] == ("rev-parse", "agent/release-final") else "target" if args[:1] == ("rev-parse",) else "1" if args[:2] == ("rev-list", "--count") else "",
    )
    result = audit(tmp_path, "target", "agent/release-final")
    assert result["audit_version"] == "11.0"
    assert result["target"]["commit_count"] == 1


def test_governance_audit_reports_impl_without_test(monkeypatch, tmp_path: Path):
    for name in [
        "AGENTS.md",
        "Docs/HOOSHYAROS_MASTER_CHARTER.md",
        "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md",
        "Docs/ARCHITECTURE.md",
        "Assistant/SYSTEM_PROMPT.md",
        "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md",
        "Docs/Engineering/FAILURE_THEORY_GOVERNANCE_LAW.md",
    ]:
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("governance placeholder", encoding="utf-8")
    (tmp_path / "AGENTS.md").write_text(
        "One Capability = One Engine = One Test = One Commit\n"
        "Python is the preferred implementation/orchestration worker\n"
        "trusted checkpoint\nminimal repair\narchitecture compliance\nBLOCKED\nduplicate engine\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(
        "Backend.AI_Runtime.audit.governance_compliance_audit_v11.run_git",
        lambda root, *args: "base" if args[:2] == ("rev-parse", "agent/release-final") else "target" if args[:1] == ("rev-parse",) else "1" if args[:2] == ("rev-list", "--count") else "Backend/HBOS/Product/X.ts",
    )
    result = audit(tmp_path, "target", "agent/release-final")
    assert any(v["id"] == "GOV-004" for v in result["violations"])
