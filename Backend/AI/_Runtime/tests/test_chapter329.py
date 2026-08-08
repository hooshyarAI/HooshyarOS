from Backend.AI._Runtime.governance_engine.decision.failure.failure_detector import (
    DecisionFailureDetector,
)

def test_chapter329_decision():
    result = DecisionFailureDetector().detect("test-decision")

    assert result["decision"] == "test-decision"
    assert result["status"] == "decision_failure_detected"
