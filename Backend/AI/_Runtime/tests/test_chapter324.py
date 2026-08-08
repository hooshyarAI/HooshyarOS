from Backend.AI._Runtime.final_runtime.unified_failure_isolation_pipeline import (
    UnifiedFailureIsolationPipeline,
)

def test_chapter324_context():
    result = UnifiedFailureIsolationPipeline().process("test-context")

    assert result["context"] == "test-context"
    assert result["status"] == "unified_failure_isolation_ready"
