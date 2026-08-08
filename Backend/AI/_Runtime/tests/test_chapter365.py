from Backend.AI._Runtime.runtime_assurance.recovery.recovery_guard import RecoveryGuard

def test_chapter365_guard():
    result = RecoveryGuard().guard("test-recovery")
    assert result["recovery"] == "test-recovery"
    assert result["status"] == "recovery_guarded"
