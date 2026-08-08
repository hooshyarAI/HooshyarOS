class RuntimeReadinessCheckpoint:
    def checkpoint(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_checkpointed",
        }
