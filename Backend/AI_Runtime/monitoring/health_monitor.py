class HealthMonitor:
    def check(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_healthy"
        }
