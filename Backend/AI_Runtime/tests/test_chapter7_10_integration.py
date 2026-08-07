from Backend.AI_Runtime.organization.organization_engine import OrganizationEngine
from Backend.AI_Runtime.operations.operations_engine import OperationsEngine
from Backend.AI_Runtime.integration.runtime_integration import RuntimeIntegration


def test_organization():

    result = OrganizationEngine().analysis if False else OrganizationEngine().analyze(
        "HooshyarOS"
    )

    assert result["status"] == "analyzed"


def test_operations():

    result = OperationsEngine().execute(
        "AI_Task"
    )

    assert result["status"] == "completed"


def test_integration():

    result = RuntimeIntegration().run(
        "FinancialEngine"
    )

    assert result["status"] == "integrated"
