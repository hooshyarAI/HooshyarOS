from Backend.AI_Runtime.organization.organizational_engine import OrganizationalEngine
from Backend.AI_Runtime.organization.role_manager import RoleManager
from Backend.AI_Runtime.organization.performance_analyzer import PerformanceAnalyzer
from Backend.AI_Runtime.organization.workflow_optimizer import WorkflowOptimizer


def test_organization_engine():

    result = OrganizationalEngine().analyze_structure(
        "Hooshyar Organization"
    )

    assert result["status"] == "analyzed"


def test_role_manager():

    result = RoleManager().evaluate_role(
        "Manager"
    )

    assert result["status"] == "evaluated"


def test_performance():

    result = PerformanceAnalyzer().analyze(
        "Team Performance"
    )

    assert result["score"] == 100


def test_workflow():

    result = WorkflowOptimizer().optimize(
        "Business Process"
    )

    assert result["status"] == "optimized"
