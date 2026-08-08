from Backend.AI._Runtime.monitoring.runtime.runtime_resilience_monitor import (
    RuntimeResilienceMonitor,
)

def test_chapter338_runtime():
    result = RuntimeResilienceMonitor().monitor("test-runtime")

    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_resilience_monitored"
