class RuntimeReadinessDecision:
    def decide(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_decided",
        }
