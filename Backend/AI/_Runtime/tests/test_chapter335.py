from Backend.AI._Runtime.monitoring.runtime.runtime_failure_monitor import (
    RuntimeFailureMonitor,
)

def test_chapter335_runtime():
    result = RuntimeFailureMonitor().monitor("test-runtime")

    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_failure_monitored"
