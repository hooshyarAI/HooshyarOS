from Backend.AI_Runtime.agents.planner.planner_agent import PlannerAgent
from Backend.AI_Runtime.agents.builder.builder_agent import BuilderAgent
from Backend.AI_Runtime.agents.tester.tester_agent import TesterAgent
from Backend.AI_Runtime.autogen.agent_runtime import AgentRuntime


def test_autogen_agents():

    runtime=AgentRuntime()


    runtime.register(
        PlannerAgent()
    )

    runtime.register(
        BuilderAgent()
    )

    runtime.register(
        TesterAgent()
    )


    result=runtime.execute(
        "BuilderAgent",
        "create module"
    )


    assert result["agent"]=="BuilderAgent"

    assert result["status"]=="completed"


    agents=runtime.list_agents()


    assert "PlannerAgent" in agents
    assert "BuilderAgent" in agents
    assert "TesterAgent" in agents
