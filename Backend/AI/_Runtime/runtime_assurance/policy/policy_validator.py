class PolicyValidator:
    def validate(self, policy):
        return {
            "policy": policy,
            "status": "policy_validated",
        }
