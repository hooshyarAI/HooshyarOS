class RuntimeReadinessObserver:
    def observe(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_observed",
        }
