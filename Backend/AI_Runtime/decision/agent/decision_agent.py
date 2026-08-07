from Backend.AI_Runtime.agents.base.runtime_agent import RuntimeAgent


class DecisionAgent(RuntimeAgent):

    def __init__(self):
        super().__init__(
            "DecisionAgent"
        )

    def decide(self, context):

        return {
            "agent": self.name,
            "context": context,
            "decision": "execute",
            "status": "decided"
        }
