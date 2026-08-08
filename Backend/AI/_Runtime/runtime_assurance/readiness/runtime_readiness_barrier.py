class RuntimeReadinessBarrier:
    def block(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_blocked",
        }
