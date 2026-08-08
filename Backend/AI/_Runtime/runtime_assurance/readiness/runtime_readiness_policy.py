class RuntimeReadinessPolicy:
    def apply(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_policy_applied",
        }
