from Backend.AI_Runtime.audit.evidence_audit_engine import EvidenceArchitectureAudit


def test_inventory_and_git_baseline(tmp_path):
    (tmp_path / "Backend" / "HBOS" / "Core").mkdir(parents=True)
    (tmp_path / "Backend" / "HBOS" / "Core" / "A.ts").write_text("export class A {}\n", encoding="utf-8")
    engine = EvidenceArchitectureAudit(tmp_path)
    result = engine.audit()
    assert result["inventory"]["code_files"] == 1
    assert result["baseline"]["head"] == ""


def test_duplicate_registry_is_detected(tmp_path):
    for rel in (
        "Backend/HBOS/Core/EngineRegistry.ts",
        "Backend/HBOS/Registry/EngineRegistry.ts",
    ):
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("export class EngineRegistry {}\n", encoding="utf-8")
    result = EvidenceArchitectureAudit(tmp_path).audit()
    assert any(f["id"] == "ARCH-REG-001" for f in result["findings"])


def test_core_upper_layer_dependency_is_detected(tmp_path):
    core = tmp_path / "Backend/HBOS/Core"
    product = tmp_path / "Backend/HBOS/Product"
    core.mkdir(parents=True)
    product.mkdir(parents=True)
    (product / "Thing.ts").write_text("export class Thing {}\n", encoding="utf-8")
    (core / "Bad.ts").write_text('import { Thing } from "../Product/Thing";\n', encoding="utf-8")
    result = EvidenceArchitectureAudit(tmp_path).audit()
    assert any(f["id"] == "ARCH-BOUND-001" for f in result["findings"])


def test_audit_writes_evidence(tmp_path):
    out = tmp_path / "out"
    result = EvidenceArchitectureAudit(tmp_path).write_evidence(out)
    assert (out / "audit.json").exists()
    assert (out / "audit_report.md").exists()
    assert result["audit_mode"] == "READ_ONLY_EVIDENCE"
