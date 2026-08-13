from Backend.AI_Runtime.autonomous_spec import generic_artifacts, spec_from_prompt


def test_repair_prompt_generates_canonical_product_identity_and_behavior():
    prompt = (
        "Capability ID: repair-product.customer-success\n"
        "Capability: repair commercial quality failure for product.customer-success\n"
        "Target Engine: Organizational Intelligence Engine\n"
        "Dependencies: Organization Model, Knowledge Engine, Dashboard Engine\n"
        "Required artifact paths: Backend/HBOS/Product/CustomerSuccessService.ts ; "
        "Backend/HBOS/test/CustomerSuccessService.test.ts ; "
        "Docs/Product/CustomerSuccessService.md\n"
        "Architecture rules: Preserve Architecture Freeze V4\n"
    )

    spec = spec_from_prompt(prompt)
    assert spec is not None

    artifacts = dict(generic_artifacts(spec))
    implementation = artifacts[spec.engine_path]
    test = artifacts[spec.test_path]
    docs = artifacts[spec.docs_path]

    assert 'capabilityId = "product.customer-success"' in implementation
    assert "evaluate(" in implementation
    assert 'toBe("product.customer-success")' in test
    assert "repair-product.customer-success" not in implementation
    assert "repair-product.customer-success" not in docs
