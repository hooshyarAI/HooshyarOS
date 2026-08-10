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
    assert len(artifacts) == 2
    assert artifacts[0][0] == f"Backend/HBOS/Engines/{engine_name}.ts"
    assert artifacts[1][0] == f"Backend/HBOS/test/{engine_name}.test.ts"

    generated = []
    for relative_path, content in artifacts:
        target = tmp_path / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        generated.append(target)

    assert all(path.exists() for path in generated)
    assert f"class {engine_name}" in generated[0].read_text(encoding="utf-8")
    assert f'describe("{engine_name}"' in generated[1].read_text(encoding="utf-8")


def test_unknown_platform_capability_is_not_invented():
    assert "platform.unknown" not in autonomous_builder.CAPABILITIES
