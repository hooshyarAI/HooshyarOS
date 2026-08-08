from Backend.AI._Runtime.runtime_assurance.resilience.resilience_guard import ResilienceGuard

def test_chapter368_guard():
    result = ResilienceGuard().guard("test-resilience")
    assert result["resilience"] == "test-resilience"
    assert result["status"] == "resilience_guarded"
