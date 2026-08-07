from Backend.AI_Runtime.agents.base.runtime_agent import RuntimeAgent


class BuilderAgent(RuntimeAgent):

    def __init__(self):
        super().__init__("BuilderAgent")

    def build(self, target):
        return {
            "agent": self.name,
            "artifact": target,
            "status": "generated"
        }
