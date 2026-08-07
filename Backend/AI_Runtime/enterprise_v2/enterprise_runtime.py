from Backend.AI_Runtime.financial_core.financial_core import FinancialIntelligenceCore
from Backend.AI_Runtime.accounting_engine.accounting_engine import AccountingUnderstandingEngine
from Backend.AI_Runtime.erp_connector.erp_connector import ERPConnector
from Backend.AI_Runtime.financial_analysis.statement_analyzer import FinancialStatementAnalyzer
from Backend.AI_Runtime.compliance.compliance_engine import ComplianceEngine
from Backend.AI_Runtime.risk_engine.risk_engine import RiskEngine
from Backend.AI_Runtime.forecasting.forecasting_engine import ForecastingEngine
from Backend.AI_Runtime.simulation.business_simulation import BusinessSimulation
from Backend.AI_Runtime.dashboard.executive_dashboard import ExecutiveDashboard


class EnterpriseRuntimeV2:

    def run(self, company):

        return {

            "financial":
                FinancialIntelligenceCore().analyze(company),

            "accounting":
                AccountingUnderstandingEngine().parse(company),

            "erp":
                ERPConnector().connect(company),

            "analysis":
                FinancialStatementAnalyzer().evaluate(company),

            "compliance":
                ComplianceEngine().check(company),

            "risk":
                RiskEngine().detect(company),

            "forecast":
                ForecastingEngine().predict(company),

            "simulation":
                BusinessSimulation().simulate(company),

            "dashboard":
                ExecutiveDashboard().build(company),

            "status":
                "enterprise_ready"
        }
