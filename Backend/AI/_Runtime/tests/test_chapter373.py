from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_monitor import RuntimeReadinessMonitor

def test_chapter373_monitor():
    result = RuntimeReadinessMonitor().monitor("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_monitored"
