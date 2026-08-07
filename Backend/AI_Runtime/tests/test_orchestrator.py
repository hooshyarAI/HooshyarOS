from Backend.AI_Runtime.orchestrator.workflow import Orchestrator


def test_orchestrator_flow():

    engine = Orchestrator()

    result = engine.execute(
        "FinancialEngine"
    )

    assert result["build"]["status"] == "generated"

    assert result["test"]["status"] == "passed"
