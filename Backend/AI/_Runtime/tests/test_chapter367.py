from Backend.AI._Runtime.runtime_assurance.recovery.recovery_monitor import RecoveryMonitor

def test_chapter367_monitor():
    result = RecoveryMonitor().monitor("test-recovery")
    assert result["recovery"] == "test-recovery"
    assert result["status"] == "recovery_monitored"
