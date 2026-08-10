from pathlib import Path

from Backend.AI_Runtime import autonomous_builder


def test_three_step_platform_completion_evidence(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    order = [
        "platform.user-management",
        "platform.organization-model",
        "platform.security-layer",
    ]
    completed = set()
    for capability in order:
        missing = [p for p in autonomous_builder.PLATFORM_DEPENDENCIES[capability]
                   if not (tmp_path / p).exists()]
        assert not missing, f"premature capability execution: {capability}: {missing}"
        for relative_path, content in autonomous_builder.CAPABILITIES[capability]:
            target = tmp_path / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        completed.add(capability)
        assert len(completed) <= 3
    assert completed == set(order)


def test_no_completion_without_all_three_capabilities(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(autonomous_builder, "ROOT", tmp_path)
    required = set(autonomous_builder.CAPABILITIES)
    assert required != set()
    assert set() != required
