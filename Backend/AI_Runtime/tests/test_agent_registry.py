from Backend.AI_Runtime.agents.core.base_agent import BaseAgent


class BuilderAgent(BaseAgent):

    def __init__(self):

        super().__init__(
            "BuilderAgent",
            "Code Generation"
        )


    def build(self, task):

        return {
            "task": task,
            "status": "generated",
            "artifact": task + ".py"
        }