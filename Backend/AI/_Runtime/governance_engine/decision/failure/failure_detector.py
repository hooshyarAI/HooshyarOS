class DecisionFailureDetector:
    def detect(self, decision):
        return {
            "decision": decision,
            "status": "decision_failure_detected",
        }
