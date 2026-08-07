from Backend.AI_Runtime.core_upgrade.hbos_core_upgrade import HBOSCoreUpgrade
from Backend.AI_Runtime.orchestration.agent_orchestrator import AgentOrchestrator
from Backend.AI_Runtime.learning.learning_engine import LearningEngine
from Backend.AI_Runtime.decision_intelligence.decision_engine import DecisionIntelligence


class RuntimeConsolidation:

    def run(self, goal):

        core = HBOSCoreUpgrade().integrate(
            ["Governance","Autonomy","Executive","Organization"]
        )

        agents = AgentOrchestrator().coordinate(
            ["Planner","Memory","Decision"]
        )

        learning = LearningEngine().learn(goal)

        decision = DecisionIntelligence().evaluate(goal)

        return {
            "core": core,
            "agents": agents,
            "learning": learning,
            "decision": decision,
            "status": "consolidated"
        }
