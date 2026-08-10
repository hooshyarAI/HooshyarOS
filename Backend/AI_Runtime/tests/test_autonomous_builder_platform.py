from pathlib import Path

import pytest

from Backend.AI_Runtime import autonomous_builder


@pytest.mark.parametrize(
    "capability_id, engine_name",
    [
        ("platform.user-management", "UserManagementEngine"),
        ("platform.organization-model", "OrganizationModelEngine"),
        ("platform.security-layer", "SecurityLayerEngine"),
    ],
)
def test_platform_capability_generation_is_explicit_and_complete(tmp_path: Path, monkeypatch, capability_id: str, engine_name: str):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    artifacts = autonomous_builder.CAPABILITIES[capability_id]
    assert [path for path, _ in artifacts] == [
        f"Backend/HBOS/Engines/{engine_name}.ts",
        f"Backend/HBOS/test/{engine_name}.test.ts",
        f"Docs/Engines/{engine_name}.md",
    ]


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
    missing = [p for p in autonomous_builder.PLATFORM_DEPENDENCIES["platform.organization-model"] if not (tmp_path / p).exists()]
    assert missing


def test_unknown_platform_capability_is_not_invented():
    assert "platform.unknown" not in autonomous_builder.CAPABILITIES
