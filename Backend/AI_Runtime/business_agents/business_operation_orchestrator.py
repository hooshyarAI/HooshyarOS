from Backend.AI_Runtime.cfo_agent.cfo_agent import CFOAgent
from Backend.AI_Runtime.controller_agent.controller_agent import ControllerAgent
from Backend.AI_Runtime.risk_agent.risk_agent import RiskAgent
from Backend.AI_Runtime.compliance_agent.compliance_agent import ComplianceAgent
from Backend.AI_Runtime.budget_agent.budget_agent import BudgetAgent
from Backend.AI_Runtime.kpi_intelligence.kpi_intelligence import KPIIntelligence
from Backend.AI_Runtime.alert_engine.alert_engine import AlertEngine
from Backend.AI_Runtime.recommendation_engine.recommendation_engine import RecommendationEngine
from Backend.AI_Runtime.scenario_simulator.scenario_simulator import ScenarioSimulator
from Backend.AI_Runtime.autonomous_executor.autonomous_executor import AutonomousExecutor


class BusinessOperationOrchestrator:

    def run(self, input):

        return {
            "cfo": CFOAgent().analyze(input),
            "controller": ControllerAgent().control(input),
            "risk": RiskAgent().assess(input),
            "compliance": ComplianceAgent().verify(input),
            "budget": BudgetAgent().evaluate(input),
            "kpi": KPIIntelligence().calculate(input),
            "alert": AlertEngine().detect(input),
            "recommendation": RecommendationEngine().recommend(input),
            "scenario": ScenarioSimulator().simulate(input),
            "execution": AutonomousExecutor().execute(input),
            "status": "business_intelligence_ready"
        }
