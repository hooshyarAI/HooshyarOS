from Backend.AI._Runtime.autonomous_control.autonomous_failure_isolation_controller import (
    AutonomousFailureIsolationController,
)

def test_chapter317_operation():
    result = AutonomousFailureIsolationController().isolate("test-operation")

    assert result["operation"] == "test-operation"
    assert result["status"] == "autonomous_failure_isolated"
