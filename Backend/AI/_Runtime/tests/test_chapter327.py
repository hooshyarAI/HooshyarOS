from Backend.AI._Runtime.final_runtime.hooshyar.hooshyar_runtime_readiness_validator import (
    HooshyarRuntimeReadinessValidator,
)

def test_chapter327_context():
    result = HooshyarRuntimeReadinessValidator().validate("test-context")

    assert result["context"] == "test-context"
    assert result["status"] == "hooshyar_runtime_readiness_validated"
