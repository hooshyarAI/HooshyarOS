class RuntimeReadinessRelease:
    def release(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_released",
        }
