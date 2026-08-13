from Backend.AI_Runtime.autonomous_spec import generic_artifacts, spec_from_prompt


def _prompt(capability_id: str) -> str:
    return (
        f"Capability ID: {capability_id}\n"
        "Capability: test a commercial product capability\n"
        "Target Engine: Organizational Intelligence Engine\n"
        "Dependencies: Knowledge Engine, Decision Engine\n"
        "Required artifact paths: Backend/HBOS/Product/KaizenImprovementService.ts ; Backend/HBOS/test/KaizenImprovementService.test.ts ; Docs/Product/KaizenImprovementService.md\n"
        "Architecture rules: Preserve Architecture Freeze V4\n"
        "Directives: Implement exactly ONE concrete capability\n"
    )


def test_repair_product_artifacts_preserve_canonical_identity_and_behavior():
    spec = spec_from_prompt(_prompt("repair-product.kaizen-continuous-improvement"))
    assert spec is not None
    artifacts = dict(generic_artifacts(spec))

    implementation = artifacts[spec.engine_path]
    test = artifacts[spec.test_path]
    docs = artifacts[spec.docs_path]

    assert 'readonly capabilityId = "product.kaizen-continuous-improvement";' in implementation
    assert "assess(" in implementation
    assert "repair-product.kaizen-continuous-improvement" not in implementation
    assert 'toBe("product.kaizen-continuous-improvement")' in test
    assert "repair-product.kaizen-continuous-improvement" not in test
    assert "Canonical product capability: `product.kaizen-continuous-improvement`." in docs
    assert "repair-product.kaizen-continuous-improvement" not in docs


def test_repair_prefix_is_idempotent_for_canonicalization():
    for capability_id in (
        "product.customer-success",
        "repair-product.customer-success",
        "repair-repair-product.customer-success",
    ):
        spec = spec_from_prompt(_prompt(capability_id))
        assert spec is not None
        artifacts = dict(generic_artifacts(spec))
        implementation = artifacts[spec.engine_path]
        assert 'readonly capabilityId = "product.customer-success";' in implementation
        assert "repair-product.customer-success" not in implementation
