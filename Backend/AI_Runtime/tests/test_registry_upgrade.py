from Backend.AI_Runtime.registry.registry import AgentRegistry
from Backend.AI_Runtime.agents.planner.planner_agent import PlannerAgent
from Backend.AI_Runtime.agents.builder.builder_agent import BuilderAgent
from Backend.AI_Runtime.agents.tester.tester_agent import TesterAgent


def test_registry():

    registry = AgentRegistry()


    registry.register(PlannerAgent())

    registry.register(BuilderAgent())

    registry.register(TesterAgent())


    agents = registry.list_agents()


    assert "PlannerAgent" in agents

    assert "BuilderAgent" in agents

    assert "TesterAgent" in agents


    assert registry.status()["PlannerAgent"] == "registered"

