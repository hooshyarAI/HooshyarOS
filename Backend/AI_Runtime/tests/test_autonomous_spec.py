from pathlib import Path

from Backend.AI_Runtime.autonomous_spec import generic_artifacts, spec_from_prompt, write_missing


def test_spec_from_prompt_builds_canonical_paths():
    spec = spec_from_prompt(
        "Capability ID: engine.example.canonical\n"
        "Capability: implement an example engine\n"
        "Target Engine: Example Intelligence Engine\n"
    )
    assert spec is not None
    assert spec.class_name == "ExampleIntelligenceEngine"
    assert spec.engine_path.endswith("Backend/HBOS/Engines/ExampleIntelligenceEngine.ts")
    assert spec.test_path.endswith("Backend/HBOS/test/ExampleIntelligenceEngine.test.ts")
    assert spec.docs_path.endswith("Docs/Engines/ExampleIntelligenceEngine.md")


def test_generic_artifacts_are_complete():
    spec = spec_from_prompt(
        "Capability ID: engine.example.canonical\n"
        "Capability: implement an example engine\n"
        "Target Engine: Example Intelligence Engine\n"
    )
    artifacts = dict(generic_artifacts(spec))
    assert "describeCapability" in artifacts[spec.engine_path]
    assert "toEqual" in artifacts[spec.test_path]
    assert "engine.example.canonical" in artifacts[spec.docs_path]


def test_write_missing_is_idempotent(tmp_path: Path):
    spec = spec_from_prompt(
        "Capability ID: engine.example.canonical\n"
        "Capability: implement an example engine\n"
        "Target Engine: Example Intelligence Engine\n"
    )
    artifacts = generic_artifacts(spec)
    assert len(write_missing(tmp_path, artifacts)) == 3
    assert write_missing(tmp_path, artifacts) == []
