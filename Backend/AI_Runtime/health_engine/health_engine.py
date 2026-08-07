class HealthEngine:

    def check(self, service):
        return {
            "service": service,
            "status": "health_checked"
        }
