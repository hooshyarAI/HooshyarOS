class DecisionValidator:
    def validate(self, decision):
        return {
            "decision": decision,
            "status": "decision_validated",
        }
