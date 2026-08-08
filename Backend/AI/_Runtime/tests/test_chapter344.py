from Backend.AI._Runtime.runtime_assurance.execution.execution_guard import ExecutionGuard

def test_chapter344_guard():
    result = ExecutionGuard().guard("test-execution")
    assert result["execution"] == "test-execution"
    assert result["status"] == "execution_guarded"
