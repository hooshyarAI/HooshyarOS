from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_policy import RuntimeReadinessPolicy

def test_chapter397():
    result = RuntimeReadinessPolicy().apply("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_policy_applied"
