from Backend.AI._Runtime.runtime_assurance.execution.execution_validator import ExecutionValidator

def test_chapter345_validate():
    result = ExecutionValidator().validate("test-execution")
    assert result["execution"] == "test-execution"
    assert result["status"] == "execution_validated"
