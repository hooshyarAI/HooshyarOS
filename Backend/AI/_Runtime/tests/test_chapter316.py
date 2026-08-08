from Backend.AI._Runtime.autonomous_control.autonomous_failure_detector import (
    AutonomousFailureDetector,
)

def test_chapter316_operation():
    result = AutonomousFailureDetector().detect("test-operation")

    assert result["operation"] == "test-operation"
    assert result["status"] == "autonomous_failure_detected"
