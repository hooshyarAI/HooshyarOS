from Backend.AI._Runtime.runtime_assurance.resilience.resilience_monitor import ResilienceMonitor

def test_chapter370_monitor():
    result = ResilienceMonitor().monitor("test-resilience")
    assert result["resilience"] == "test-resilience"
    assert result["status"] == "resilience_monitored"
