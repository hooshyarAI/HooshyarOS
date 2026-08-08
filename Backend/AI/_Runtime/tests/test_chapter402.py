from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_release import RuntimeReadinessRelease

def test_chapter402():
    result = RuntimeReadinessRelease().release("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_released"
