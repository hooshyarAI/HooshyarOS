class DecisionMemory:

    def store(self, decision):
        return {
            "decision": decision,
            "status": "stored"
        }