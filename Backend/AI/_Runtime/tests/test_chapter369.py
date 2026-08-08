from Backend.AI._Runtime.runtime_assurance.resilience.resilience_validator import ResilienceValidator

def test_chapter369_validate():
    result = ResilienceValidator().validate("test-resilience")
    assert result["resilience"] == "test-resilience"
    assert result["status"] == "resilience_validated"
