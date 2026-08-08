from Backend.AI._Runtime.runtime_assurance.policy.policy_monitor import PolicyMonitor

def test_chapter352_monitor():
    result = PolicyMonitor().monitor("test-policy")
    assert result["policy"] == "test-policy"
    assert result["status"] == "policy_monitored"
