from Backend.AI_Runtime.agents.base.runtime_agent import RuntimeAgent

class PlannerAgent(RuntimeAgent):

    def __init__(self):
        super().__init__(
            "PlannerAgent"
        )

    def plan(self, goal):

        return {
            "agent": self.name,
            "goal": goal,
            "steps": [
                "analysis",
                "build",
                "test"
            ],
            "status": "planned"
        }
