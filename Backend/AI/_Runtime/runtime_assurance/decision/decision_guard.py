class DecisionGuard:
    def guard(self, decision):
        return {
            "decision": decision,
            "status": "decision_guarded",
        }
