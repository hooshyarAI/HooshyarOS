from Backend.AI._Runtime.governance_engine.intelligence.failure.isolation.failure_isolation_gate import (
    IntelligenceFailureIsolationGate,
)


def test_chapter313_intelligence_failure_isolation():
    result = IntelligenceFailureIsolationGate().isolate("test-intelligence")

    assert result["intelligence"] == "test-intelligence"
    assert result["status"] == "intelligence_failure_isolated"
