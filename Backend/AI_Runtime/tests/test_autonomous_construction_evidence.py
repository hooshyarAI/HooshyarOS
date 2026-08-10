from pathlib import Path

from Backend.AI_Runtime import autonomous_builder


def test_three_step_construction_produces_complete_evidence_in_order(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)

    for capability_id in (
        "platform.user-management",
        "platform.organization-model",
        "platform.security-layer",
    ):
        missing = [
            path
            for path in autonomous_builder.PLATFORM_DEPENDENCIES[capability_id]
            if not (tmp_path / path).exists()
        ]
        assert not missing, f"{capability_id} cannot advance before its prerequisites"

        for relative_path, content in autonomous_builder.CAPABILITIES[capability_id]:
            target = tmp_path / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

    expected = [
        "Backend/HBOS/Engines/UserManagementEngine.ts",
        "Backend/HBOS/test/UserManagementEngine.test.ts",
        "Docs/Engines/UserManagementEngine.md",
        "Backend/HBOS/Engines/OrganizationModelEngine.ts",
        "Backend/HBOS/test/OrganizationModelEngine.test.ts",
        "Docs/Engines/OrganizationModelEngine.md",
        "Backend/HBOS/Engines/SecurityLayerEngine.ts",
        "Backend/HBOS/test/SecurityLayerEngine.test.ts",
        "Docs/Engines/SecurityLayerEngine.md",
    ]
    assert all((tmp_path / path).exists() for path in expected)
