from Backend.AI_Runtime.executive_memory.executive_memory import ExecutiveMemory
from Backend.AI_Runtime.executive_dashboard.executive_dashboard import ExecutiveDashboard
from Backend.AI_Runtime.kpi_engine.kpi_engine import KPIEngine
from Backend.AI_Runtime.strategic_analysis.strategic_analysis import StrategicAnalysis
from Backend.AI_Runtime.decision_support.decision_support import DecisionSupport
from Backend.AI_Runtime.scenario_engine.scenario_engine import ScenarioEngine
from Backend.AI_Runtime.risk_intelligence.risk_intelligence import RiskIntelligence
from Backend.AI_Runtime.performance_engine.performance_engine import PerformanceEngine
from Backend.AI_Runtime.executive_advisor.executive_advisor import ExecutiveAdvisor


class ExecutiveIntelligenceOrchestrator:

    def run(self, input):

        return {
            "memory": ExecutiveMemory().store(input),
            "dashboard": ExecutiveDashboard().generate(input),
            "kpi": KPIEngine().measure(input),
            "strategy": StrategicAnalysis().analysis(input),
            "decision": DecisionSupport().support(input),
            "scenario": ScenarioEngine().simulate(input),
            "risk": RiskIntelligence().assess(input),
            "performance": PerformanceEngine().evaluate(input),
            "advisor": ExecutiveAdvisor().advise(input),
            "status": "executive_intelligence_ready"
        }
