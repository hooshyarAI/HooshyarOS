from Backend.AI_Runtime.agents.financial_analyst.financial_analyst_agent import FinancialAnalystAgent
from Backend.AI_Runtime.agents.decision_agent.decision_agent import DecisionAgent
from Backend.AI_Runtime.agents.auditor_agent.auditor_agent import AuditorAgent
from Backend.AI_Runtime.agents.tax_agent.tax_agent import TaxAgent
from Backend.AI_Runtime.agents.report_agent.report_agent import ReportAgent
from Backend.AI_Runtime.agents.strategy_agent.strategy_agent import StrategyAgent
from Backend.AI_Runtime.agents.supervisor_agent.supervisor_agent import SupervisorAgent
from Backend.AI_Runtime.agents.learning_agent.learning_agent import LearningAgent
from Backend.AI_Runtime.agents.tool_agent.tool_agent import ToolAgent


class AgentCoordinator:


    def run(self, input):

        return {

            "financial":
                FinancialAnalystAgent().analyze(input),

            "decision":
                DecisionAgent().decide(input),

            "audit":
                AuditorAgent().audit(input),

            "tax":
                TaxAgent().check(input),

            "report":
                ReportAgent().generate(input),

            "strategy":
                StrategyAgent().create(input),

            "supervisor":
                SupervisorAgent().supervise(input),

            "learning":
                LearningAgent().improve(input),

            "tool":
                ToolAgent().use(input),

            "status":
                "agents_active"
        }

