from Backend.AI._Runtime.runtime_assurance.policy.policy_validator import PolicyValidator

def test_chapter351_validate():
    result = PolicyValidator().validate("test-policy")
    assert result["policy"] == "test-policy"
    assert result["status"] == "policy_validated"
