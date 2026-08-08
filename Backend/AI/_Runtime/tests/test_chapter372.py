from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_validator import RuntimeReadinessValidator

def test_chapter372_validate():
    result = RuntimeReadinessValidator().validate("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_validated"
