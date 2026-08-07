from Backend.AI_Runtime.agents.core.base_agent import BaseAgent


class TesterAgent(BaseAgent):
    __test__ = False

    def __init__(self):
        super().__init__(
            "TesterAgent",
            "Quality Testing"
        )


    def test(self, artifact):

        return {
            "artifact": artifact,
            "status": "passed"
        }
