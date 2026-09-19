from pathlib import Path
import sys

import pytest

from Backend.AI_Runtime import autonomous_builder


@pytest.mark.parametrize(
    "capability_id, expected_paths",
    [
        (
            "platform.user-management",
            [
                "Backend/HBOS/Engines/UserManagementEngine.ts",
                "Backend/HBOS/test/UserManagementEngine.test.ts",
                "Docs/Engines/UserManagementEngine.md",
            ],
        ),
        (
            "platform.organization-model",
            [
                "Backend/HBOS/Engines/OrganizationModelEngine.ts",
                "Backend/HBOS/test/OrganizationModelEngine.test.ts",
                "Docs/Engines/OrganizationModelEngine.md",
            ],
        ),
        (
            "platform.security-layer",
            [
                "Backend/HBOS/Engines/SecurityLayerEngine.ts",
                "Backend/HBOS/test/SecurityLayerEngine.test.ts",
                "Docs/Engines/SecurityLayerEngine.md",
            ],
        ),
        (
            "engine.reasoning.canonical",
            [
                "Backend/HBOS/Engines/ReasoningEngine.ts",
                "Backend/HBOS/test/ReasoningEngine.test.ts",
            ],
        ),
        (
            "engine.organizational.canonical",
            [
                "Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts",
                "Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts",
            ],
        ),
        (
            "engine.autonomous-operations.canonical",
            [
                "Backend/HBOS/Engines/AutonomousOperationsEngine.ts",
                "Backend/HBOS/test/AutonomousOperationsEngine.test.ts",
            ],
        ),
        (
            "runtime.reasoning.bridge",
            [
                "Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts",
                "Backend/HBOS/test/PythonReasoningAdapter.test.ts",
            ],
        ),
    ],
)
def test_canonical_capability_generation_is_explicit_and_complete(
    tmp_path: Path,
    monkeypatch,
    capability_id: str,
    expected_paths: list[str],
):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    artifacts = autonomous_builder.CAPABILITIES[capability_id]
    assert [path for path, _ in artifacts] == expected_paths


def test_generated_engine_contract_matches_hbos_core_interface():
    engine_code = dict(autonomous_builder.CAPABILITIES["platform.user-management"])[
        "Backend/HBOS/Engines/UserManagementEngine.ts"
    ]
    assert 'import { Engine } from "../Core/Engine";' in engine_code
    assert "implements Engine" in engine_code
    assert "initialize(): void" in engine_code
    assert "health(): boolean" in engine_code


def test_platform_dependencies_form_a_strict_weaving_order():
    assert autonomous_builder.PLATFORM_DEPENDENCIES["platform.user-management"] == []
    assert "Backend/HBOS/Engines/UserManagementEngine.ts" in autonomous_builder.PLATFORM_DEPENDENCIES["platform.organization-model"]
    security = autonomous_builder.PLATFORM_DEPENDENCIES["platform.security-layer"]
    assert "Backend/HBOS/Engines/UserManagementEngine.ts" in security
    assert "Backend/HBOS/Engines/OrganizationModelEngine.ts" in security


def test_platform_dependencies_block_premature_execution(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    missing = [
        p
        for p in autonomous_builder.PLATFORM_DEPENDENCIES["platform.organization-model"]
        if not (tmp_path / p).exists()
    ]
    assert missing


def test_runtime_bridge_requires_reasoning_evidence(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    missing = [
        p
        for p in autonomous_builder.CAPABILITY_DEPENDENCIES["runtime.reasoning.bridge"]
        if not (tmp_path / p).exists()
    ]
    assert missing


def test_unknown_platform_capability_is_not_invented():
    assert "platform.unknown" not in autonomous_builder.CAPABILITIES


def test_blocked_dependency_produces_machine_readable_help_required(tmp_path: Path, monkeypatch, capsys):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "autonomous_builder.py",
            "--prompt",
            "Capability ID: platform.organization-model\nCapability: implement organization model\nTarget Engine: Organization Model Engine",
        ],
    )
    result = autonomous_builder.main()
    captured = capsys.readouterr()
    assert result == 3
    assert "HELP_REQUIRED" in captured.out
    assert "ESCALATE" in captured.out
    assert "CAPABILITY: platform.organization-model" in captured.out
    assert "EVIDENCE_REQUIRED" in captured.out


def test_evidence_dir_allows_reverification_after_operator_intervention(tmp_path: Path, monkeypatch, capsys):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    # Create the dependency that was missing.
    dep = "Backend/HBOS/Engines/UserManagementEngine.ts"
    (tmp_path / dep).parent.mkdir(parents=True, exist_ok=True)
    (tmp_path / dep).write_text("export class UserManagementEngine {}", encoding="utf-8")
    evidence_dir = tmp_path / "operator_evidence"
    evidence_dir.mkdir()
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "autonomous_builder.py",
            "--prompt",
            "Capability ID: platform.organization-model\nCapability: implement organization model\nTarget Engine: Organization Model Engine",
            "--evidence-dir",
            str(evidence_dir),
        ],
    )
    result = autonomous_builder.main()
    captured = capsys.readouterr()
    # After evidence, the remaining dependencies are still missing, so it should still block.
    # But the evidence dir caused a re-verification attempt.
    assert result == 3
    assert "HELP_REQUIRED" in captured.out


def test_evidence_dir_resolves_blocker_when_all_dependencies_present(tmp_path: Path, monkeypatch, capsys):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    deps = [
        "Backend/HBOS/Engines/UserManagementEngine.ts",
        "Backend/HBOS/test/UserManagementEngine.test.ts",
        "Docs/Engines/UserManagementEngine.md",
    ]
    for dep in deps:
        (tmp_path / dep).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / dep).write_text("placeholder", encoding="utf-8")
    evidence_dir = tmp_path / "operator_evidence"
    evidence_dir.mkdir()
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "autonomous_builder.py",
            "--prompt",
            "Capability ID: platform.organization-model\nCapability: implement organization model\nTarget Engine: Organization Model Engine",
            "--evidence-dir",
            str(evidence_dir),
        ],
    )
    result = autonomous_builder.main()
    captured = capsys.readouterr()
    assert result == 0
    assert "Generated:" in captured.out


def test_kilo_is_not_a_mandatory_runtime_dependency():
    source = Path(autonomous_builder.__file__).read_text(encoding="utf-8")
    assert "import kilo" not in source.lower()
    assert "from kilo" not in source.lower()
    assert "kilo" not in source.lower() or "approved operator" in source.lower() or "kilo code" in source.lower()
