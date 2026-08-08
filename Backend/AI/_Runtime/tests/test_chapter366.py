from Backend.AI._Runtime.runtime_assurance.recovery.recovery_validator import RecoveryValidator

def test_chapter366_validate():
    result = RecoveryValidator().validate("test-recovery")
    assert result["recovery"] == "test-recovery"
    assert result["status"] == "recovery_validated"
