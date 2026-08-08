from Backend.AI._Runtime.governance_engine.governance.failure.isolation.failure_isolation_gate import (
    GovernanceFailureIsolationGate,
)

def test_chapter332_governance():
    result = GovernanceFailureIsolationGate().isolate("test-governance")

    assert result["governance"] == "test-governance"
    assert result["status"] == "governance_failure_isolated"
