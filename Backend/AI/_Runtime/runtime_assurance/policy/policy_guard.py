class PolicyGuard:
    def guard(self, policy):
        return {
            "policy": policy,
            "status": "policy_guarded",
        }
