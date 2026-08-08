from Backend.AI._Runtime.runtime_assurance.policy.policy_guard import PolicyGuard

def test_chapter350_guard():
    result = PolicyGuard().guard("test-policy")
    assert result["policy"] == "test-policy"
    assert result["status"] == "policy_guarded"
