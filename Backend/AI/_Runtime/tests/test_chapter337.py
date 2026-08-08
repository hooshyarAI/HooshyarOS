from Backend.AI._Runtime.monitoring.runtime.runtime_recovery_monitor import (
    RuntimeRecoveryMonitor,
)

def test_chapter337_runtime():
    result = RuntimeRecoveryMonitor().monitor("test-runtime")

    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_recovery_monitored"
