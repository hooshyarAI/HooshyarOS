from Backend.AI._Runtime.governance_engine.governance.failure.failure_detector import (
    GovernanceFailureDetector,
)

def test_chapter331_governance():
    result = GovernanceFailureDetector().detect("test-governance")

    assert result["governance"] == "test-governance"
    assert result["status"] == "governance_failure_detected"
