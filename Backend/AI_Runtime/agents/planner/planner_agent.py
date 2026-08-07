from Backend.AI_Runtime.agents.core.base_agent import BaseAgent


class PlannerAgent(BaseAgent):

    def __init__(self):
        super().__init__(
            "PlannerAgent",
            "Planning"
        )

    def plan(self, goal):

        return {
            "goal": goal,
            "steps": [
                "analysis",
                "design",
                "execution",
                "test"
            ]
        }