from pathlib import Path

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
