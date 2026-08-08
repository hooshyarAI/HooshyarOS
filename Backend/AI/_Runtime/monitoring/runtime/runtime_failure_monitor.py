class RuntimeFailureMonitor:
    def monitor(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_failure_monitored",
        }
