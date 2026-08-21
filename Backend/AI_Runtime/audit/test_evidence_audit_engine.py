from Backend.AI_Runtime.audit.evidence_audit_engine import EvidenceArchitectureAudit


def test_inventory_and_git_baseline(tmp_path):
    (tmp_path / "Backend" / "HBOS" / "Core").mkdir(parents=True)
    (tmp_path / "Backend" / "HBOS" / "Core" / "A.ts").write_text("export class A {}\n", encoding="utf-8")
    result = EvidenceArchitectureAudit(tmp_path).audit()
    assert result["inventory"]["code_files"] == 1
    assert result["baseline"]["head"] == ""


def test_duplicate_registry_is_detected_and_confirmed(tmp_path):
    for rel in (
        "Backend/HBOS/Core/EngineRegistry.ts",
        "Backend/HBOS/Registry/EngineRegistry.ts",
    ):
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("export class EngineRegistry {}\n", encoding="utf-8")
    result = EvidenceArchitectureAudit(tmp_path).audit()
    finding = next(f for f in result["findings"] if f["id"] == "ARCH-REG-001")
    assert finding["disposition"] == "CONFIRMED_ARCHITECTURE_FINDING"
    assert finding["evidence_count"] == 1
    assert finding["confidence"] == 1.0


def test_core_upper_layer_dependency_is_aggregated(tmp_path):
    core = tmp_path / "Backend/HBOS/Core"
    product = tmp_path / "Backend/HBOS/Product"
    core.mkdir(parents=True)
    product.mkdir(parents=True)
    (product / "Thing.ts").write_text("export class Thing {}\n", encoding="utf-8")
    (core / "Bad.ts").write_text('import { Thing } from "../Product/Thing";\n', encoding="utf-8")
    result = EvidenceArchitectureAudit(tmp_path).audit()
    finding = next(f for f in result["findings"] if f["id"] == "ARCH-BOUND-001")
    assert finding["disposition"] == "ARCHITECTURE_FINDING_REQUIRES_LAYER_SEMANTICS"
    assert finding["confidence"] == 0.85


def test_security_read_signal_is_not_declared_vulnerability(tmp_path):
    runtime = tmp_path / "Backend/HBOS/Product"
    runtime.mkdir(parents=True)
    (runtime / "Reader.ts").write_text(
        'import { readFile } from "fs/promises";\nawait readFile("x", "utf8");\n',
        encoding="utf-8",
    )
    result = EvidenceArchitectureAudit(tmp_path).audit()
    finding = next(f for f in result["findings"] if f["id"] == "SEC-PATH-001")
    assert finding["severity"] == "SIGNAL"
    assert finding["disposition"] == "SIGNAL_REQUIRES_CONTEXT"
    assert finding["evidence_count"] == 1


def test_audit_writes_v2_evidence(tmp_path):
    out = tmp_path / "out"
    result = EvidenceArchitectureAudit(tmp_path).write_evidence(out)
    assert (out / "audit.json").exists()
    assert (out / "audit_report.md").exists()
    assert result["audit_version"] == "2.0"
    assert "afferent_coupling" in result["dependency_graph"]
    assert "efferent_coupling" in result["dependency_graph"]
    assert "instability" in result["dependency_graph"]
