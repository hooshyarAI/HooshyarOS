from pathlib import Path

from Backend.AI_Runtime.autonomous_spec import (
    generic_artifacts,
    spec_from_prompt,
    validate_spec,
    write_missing,
)


PROMPT = (
    "Capability ID: engine.example.canonical\n"
    "Capability: implement an example engine\n"
    "Target Engine: Example Intelligence Engine\n"
    "Dependencies: Memory Engine, Decision Engine\n"
    "Architecture rules: Everything is an Engine; One Capability= One Engine = One Test = One Commit; Reuse existing capabilities; do not create duplicate engines\n"
    "Directives: Read Docs/ARCHITECTURE.md before changing code; Implement exactly ONE concrete capability from the canonical backlog\n"
)


PRODUCT_PROMPT = (
    "Capability ID: product.financial-data-ingestion\n"
    "Capability: ingest and normalize repository-supported financial/accounting data for the Financial Intelligence Engine\n"
    "Target Engine: Financial Intelligence Engine\n"
    "Dependencies: Knowledge Engine, Financial Intelligence Engine\n"
    "Required artifact paths: Backend/HBOS/Product/FinancialDataIngestionAdapter.ts ; Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts ; Docs/Product/FinancialDataIngestionAdapter.md\n"
    "Architecture rules: Preserve Architecture Freeze V4 and existing engine boundaries\n"
    "Directives: Implement exactly ONE concrete capability from the canonical backlog\n"
)


def test_spec_from_prompt_builds_canonical_paths_and_contract():
    spec = spec_from_prompt(PROMPT)
    assert spec is not None
    assert spec.class_name == "ExampleIntelligenceEngine"
    assert spec.engine_path.endswith("Backend/HBOS/Engines/ExampleIntelligenceEngine.ts")
    assert spec.test_path.endswith("Backend/HBOS/test/ExampleIntelligenceEngine.test.ts")
    assert spec.docs_path.endswith("Docs/Engines/ExampleIntelligenceEngine.md")
    assert spec.dependencies == ("Memory Engine", "Decision Engine")
    assert "Everything is an Engine" in spec.architecture_rules
    assert "Implement exactly ONE concrete capability from the canonical backlog" in spec.directives
    assert validate_spec(spec) == []


def test_product_spec_honors_declared_artifact_paths():
    spec = spec_from_prompt(PRODUCT_PROMPT)
    assert spec is not None
    assert spec.class_name == "FinancialDataIngestionAdapter"
    assert spec.engine_path == "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts"
    assert spec.test_path == "Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts"
    assert spec.docs_path == "Docs/Product/FinancialDataIngestionAdapter.md"

    artifacts = dict(generic_artifacts(spec))
    assert "class FinancialDataIngestionAdapter" in artifacts[spec.engine_path]
    assert "ingest(" in artifacts[spec.engine_path]
    assert "../Product/FinancialDataIngestionAdapter" in artifacts[spec.test_path]
    assert "product.financial-data-ingestion" in artifacts[spec.docs_path]


def test_generic_artifacts_preserve_architecture_contract():
    spec = spec_from_prompt(PROMPT)
    artifacts = dict(generic_artifacts(spec))
    assert "describeCapability" in artifacts[spec.engine_path]
    assert "initialize(): void" in artifacts[spec.engine_path]
    assert "health(): boolean" in artifacts[spec.engine_path]
    assert "toEqual" in artifacts[spec.test_path]
    docs = artifacts[spec.docs_path]
    assert "Memory Engine, Decision Engine" in docs
    assert "Everything is an Engine" in docs
    assert "Implement exactly ONE concrete capability" in docs


def test_write_missing_is_idempotent(tmp_path: Path):
    spec = spec_from_prompt(PROMPT)
    artifacts = generic_artifacts(spec)
    assert len(write_missing(tmp_path, artifacts)) == 3
    assert write_missing(tmp_path, artifacts) == []


def test_write_missing_refuses_partial_construction(tmp_path: Path):
    spec = spec_from_prompt(PROMPT)
    artifacts = generic_artifacts(spec)
    first_path, _ = artifacts[0]
    (tmp_path / first_path).parent.mkdir(parents=True, exist_ok=True)
    (tmp_path / first_path).write_text("existing", encoding="utf-8")

    try:
        write_missing(tmp_path, artifacts)
    except RuntimeError as error:
        assert "partial autonomous construction" in str(error)
    else:
        raise AssertionError("partial construction must be rejected")
