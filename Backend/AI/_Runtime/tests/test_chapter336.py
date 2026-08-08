from Backend.AI._Runtime.monitoring.runtime.runtime_isolation_monitor import (
    RuntimeIsolationMonitor,
)

def test_chapter336_runtime():
    result = RuntimeIsolationMonitor().monitor("test-runtime")

    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_isolation_monitored"
