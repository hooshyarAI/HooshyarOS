from Backend.AI._Runtime.runtime_assurance.decision.decision_guard import DecisionGuard

def test_chapter347_guard():
    result = DecisionGuard().guard("test-decision")
    assert result["decision"] == "test-decision"
    assert result["status"] == "decision_guarded"
