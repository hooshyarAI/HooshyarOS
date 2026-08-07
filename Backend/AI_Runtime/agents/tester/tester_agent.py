from Backend.AI_Runtime.agents.base.runtime_agent import RuntimeAgent

class TesterAgent(RuntimeAgent):

    def __init__(self):
        super().__init__(
            "TesterAgent"
        )

    def test(self, artifact):

        return {
            "agent": self.name,
            "artifact": artifact,
            "status": "passed"
        }
