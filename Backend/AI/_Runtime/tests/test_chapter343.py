from Backend.AI._Runtime.governance_engine.intelligence.failure.failure_detector import (
    IntelligenceFailureDetector,
)

def test_chapter343_intelligence():
    result = IntelligenceFailureDetector().detect("test-intelligence")

    assert result["intelligence"] == "test-intelligence"
    assert result["status"] == "intelligence_failure_detected"
