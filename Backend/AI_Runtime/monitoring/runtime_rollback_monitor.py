class RuntimeRollbackMonitor:
    def monitor(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_rollback_monitored"
        }
