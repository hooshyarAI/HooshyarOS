class PolicyEngine:

    def check(self, policy):
        return {
            "policy": policy,
            "status": "policy_checked"
        }
