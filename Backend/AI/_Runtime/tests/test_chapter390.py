from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_barrier import RuntimeReadinessBarrier

def test_chapter390():
    result = RuntimeReadinessBarrier().block("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_blocked"
