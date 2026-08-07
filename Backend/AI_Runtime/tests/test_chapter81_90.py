from Backend.AI_Runtime.agents.financial_analyst.financial_analyst_agent import FinancialAnalystAgent
from Backend.AI_Runtime.agents.decision_agent.decision_agent import DecisionAgent
from Backend.AI_Runtime.agents.auditor_agent.auditor_agent import AuditorAgent
from Backend.AI_Runtime.agents.tax_agent.tax_agent import TaxAgent
from Backend.AI_Runtime.agents.report_agent.report_agent import ReportAgent
from Backend.AI_Runtime.agents.strategy_agent.strategy_agent import StrategyAgent
from Backend.AI_Runtime.agents.supervisor_agent.supervisor_agent import SupervisorAgent
from Backend.AI_Runtime.agents.learning_agent.learning_agent import LearningAgent
from Backend.AI_Runtime.agents.tool_agent.tool_agent import ToolAgent
from Backend.AI_Runtime.agents.coordinator.agent_coordinator import AgentCoordinator


def test_chapter81_90():

    assert FinancialAnalystAgent().analyze("x")["status"] == "financial_analyzed"
    assert DecisionAgent().decide("x")["status"] == "decision_created"
    assert AuditorAgent().audit("x")["status"] == "audited"
    assert TaxAgent().check("x")["status"] == "tax_checked"
    assert ReportAgent().generate("x")["status"] == "report_generated"
    assert StrategyAgent().create("x")["status"] == "strategy_created"
    assert SupervisorAgent().supervise("x")["status"] == "supervised"
    assert LearningAgent().improve("x")["status"] == "learning_updated"
    assert ToolAgent().use("x")["status"] == "tool_used"
    assert AgentCoordinator().run("x")["status"] == "agents_active"

