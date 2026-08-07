from Backend.AI_Runtime.autonomy.autonomy_engine import AutonomyEngine
from Backend.AI_Runtime.autonomy.execution_loop import ExecutionLoop


def test_autonomy_engine():

    result = AutonomyEngine().run(
        "FinancialEngine"
    )

    assert result["autonomy"] is True


def test_execution_loop():

    result = ExecutionLoop().execute(
        "FinancialEngine"
    )

    assert result["status"] == "running"
