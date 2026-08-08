from Backend.AI._Runtime.governance_engine.governance.continuity.continuity_validator import (
    GovernanceContinuityValidator,
)

def test_chapter330_context():
    result = GovernanceContinuityValidator().validate("test-context")

    assert result["context"] == "test-context"
    assert result["status"] == "governance_continuity_validated"
