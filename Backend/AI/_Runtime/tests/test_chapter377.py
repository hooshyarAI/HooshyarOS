from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_checker import RuntimeReadinessChecker

def test_chapter377():
    result = RuntimeReadinessChecker().check("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_checked"
