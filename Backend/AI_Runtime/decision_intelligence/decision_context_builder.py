class DecisionContextBuilder:

    def build(self, signals):
        return {
            "signals": signals,
            "status": "decision_context_ready"
        }
