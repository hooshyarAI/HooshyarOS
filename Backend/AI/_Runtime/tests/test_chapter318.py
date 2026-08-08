from Backend.AI._Runtime.autonomous_control.autonomous_recovery_coordinator import (
    AutonomousRecoveryCoordinator,
)

def test_chapter318_context():
    result = AutonomousRecoveryCoordinator().coordinate("test-context")

    assert result["context"] == "test-context"
    assert result["status"] == "autonomous_recovery_coordinated"
