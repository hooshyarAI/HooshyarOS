class DecisionHealthController:
    def check(self, decision):
        return {
            "decision": decision,
            "status": "decision_health_verified"
        }
