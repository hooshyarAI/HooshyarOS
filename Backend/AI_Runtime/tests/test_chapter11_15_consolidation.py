from Backend.AI_Runtime.core_upgrade.hbos_core_upgrade import HBOSCoreUpgrade
from Backend.AI_Runtime.orchestration.agent_orchestrator import AgentOrchestrator
from Backend.AI_Runtime.learning.learning_engine import LearningEngine
from Backend.AI_Runtime.decision_intelligence.decision_engine import DecisionIntelligence
from Backend.AI_Runtime.consolidation.runtime_consolidation import RuntimeConsolidation


def test_core():
    assert HBOSCoreUpgrade().integrate([])["status"] == "integrated"


def test_orchestration():
    assert AgentOrchestrator().coordinate([])["status"] == "coordinated"


def test_learning():
    assert LearningEngine().learn("data")["status"] == "learned"


def test_decision():
    assert DecisionIntelligence().evaluate("decision")["status"] == "evaluated"


def test_consolidation():

    result = RuntimeConsolidation().run(
        "HooshyarOS"
    )

    assert result["status"] == "consolidated"
