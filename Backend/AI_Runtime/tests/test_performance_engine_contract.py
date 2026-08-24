from Backend.AI_Runtime.performance.performance_engine import PerformanceEngine


def test_performance_engine_evaluates_metric():
    assert PerformanceEngine().evaluate("x")["status"] == "evaluated"
