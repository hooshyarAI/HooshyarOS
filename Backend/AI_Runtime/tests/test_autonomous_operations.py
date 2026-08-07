from Backend.AI_Runtime.operations.operations_engine import AutonomousOperationsEngine
from Backend.AI_Runtime.operations.task_planner import TaskPlanner
from Backend.AI_Runtime.operations.task_executor import TaskExecutor
from Backend.AI_Runtime.operations.monitoring_agent import MonitoringAgent


def test_operations_engine():

    result = AutonomousOperationsEngine().execute(
        "Financial Task"
    )

    assert result["status"] == "executed"


def test_task_planner():

    result = TaskPlanner().create_task(
        "Build Report"
    )

    assert result["status"] == "planned"


def test_executor():

    result = TaskExecutor().run(
        "Generate Dashboard"
    )

    assert result["status"] == "completed"


def test_monitor():

    result = MonitoringAgent().monitor(
        "AI Runtime"
    )

    assert result["status"] == "monitored"
