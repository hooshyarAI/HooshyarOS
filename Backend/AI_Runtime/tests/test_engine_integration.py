from Backend.AI_Runtime.integration.engine_integrator import EngineIntegrator
from Backend.AI_Runtime.integration.intelligence_coordinator import IntelligenceCoordinator
from Backend.AI_Runtime.integration.decision_pipeline import DecisionPipeline


def test_engine_integration():

    result = EngineIntegrator().connect(
        [
            "Reasoning",
            "Governance",
            "Executive",
            "Organization",
            "Operations"
        ]
    )

    assert result["status"] == "integrated"
    assert result["count"] == 5


def test_coordinator():

    result = IntelligenceCoordinator().coordinate(
        "Financial Decision"
    )

    assert result["status"] == "coordinated"


def test_pipeline():

    result = DecisionPipeline().run(
        "Approve Budget"
    )

    assert result["status"] == "processed"
