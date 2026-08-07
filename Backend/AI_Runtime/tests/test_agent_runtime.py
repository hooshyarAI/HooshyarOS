from Backend.AI_Runtime.autogen.agent_runtime import AgentRuntime


class MockAgent:

    def __init__(self,name):

        self.name=name


    def execute(self,task):

        return {
            "agent":self.name,
            "task":task,
            "status":"done"
        }


def test_agent_runtime():

    runtime=AgentRuntime()


    runtime.register(
        MockAgent("PlannerAgent")
    )


    runtime.register(
        MockAgent("BuilderAgent")
    )


    result=runtime.execute(
        "PlannerAgent",
        "design engine"
    )


    assert result["status"]=="done"

    assert "PlannerAgent" in runtime.list_agents()
