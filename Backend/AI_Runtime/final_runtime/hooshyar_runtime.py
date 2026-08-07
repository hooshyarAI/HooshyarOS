from Backend.AI_Runtime.autonomous_loop.decision_loop import AutonomousDecisionLoop
from Backend.AI_Runtime.advanced_memory.memory_engine import AdvancedMemoryEngine
from Backend.AI_Runtime.multi_agent.coordinator import MultiAgentCoordinator
from Backend.AI_Runtime.enterprise_governance.enterprise_governance import EnterpriseGovernance


class HooshyarRuntime:

    def boot(self, mission):

        decision = AutonomousDecisionLoop().execute(
            mission
        )

        memory = AdvancedMemoryEngine().store(
            mission
        )

        agents = MultiAgentCoordinator().coordinate(
            [
                "Planner",
                "Memory",
                "Decision",
                "Governance"
            ]
        )

        governance = EnterpriseGovernance().approve(
            mission
        )

        return {
            "decision": decision,
            "memory": memory,
            "agents": agents,
            "governance": governance,
            "status": "running"
        }
