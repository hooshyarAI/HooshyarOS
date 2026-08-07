from Backend.AI_Runtime.agents.planner.planner_agent import PlannerAgent


def test_planner_creates_plan():

    planner = PlannerAgent()

    result = planner.plan(
        "Build Financial Engine"
    )

    assert result["goal"] == "Build Financial Engine"

    assert "analysis" in result["steps"]
    assert "test" in result["steps"]