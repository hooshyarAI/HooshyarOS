from Backend.AI._Runtime.runtime_assurance.governance.governance_validator import GovernanceValidator

def test_chapter354_validate():
    result = GovernanceValidator().validate("test-governance")
    assert result["governance"] == "test-governance"
    assert result["status"] == "governance_validated"
