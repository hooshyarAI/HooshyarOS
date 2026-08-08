from Backend.AI._Runtime.governance_engine.intelligence.failure.failure_detector import (
    IntelligenceFailureDetector,
)


def test_chapter311_intelligence_failure_detection():
    result = IntelligenceFailureDetector().detect("test-intelligence")

    assert result["intelligence"] == "test-intelligence"
    assert result["status"] == "intelligence_failure_detected"
