from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_execution import RuntimeReadinessExecution

def test_chapter400():
    result = RuntimeReadinessExecution().execute("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_executed"
