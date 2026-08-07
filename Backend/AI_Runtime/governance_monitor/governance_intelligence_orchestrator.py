from Backend.AI_Runtime.policy_engine.policy_engine import PolicyEngine
from Backend.AI_Runtime.compliance_intelligence.compliance_intelligence import ComplianceIntelligence
from Backend.AI_Runtime.audit_memory.audit_memory import AuditMemory
from Backend.AI_Runtime.regulatory_monitoring.regulatory_monitoring import RegulatoryMonitoring
from Backend.AI_Runtime.control_framework.control_framework import ControlFramework
from Backend.AI_Runtime.governance_decision.governance_decision import GovernanceDecision
from Backend.AI_Runtime.governance_learning.governance_learning import GovernanceLearning
from Backend.AI_Runtime.risk_control.risk_control import RiskControl
from Backend.AI_Runtime.governance_monitor.governance_monitor import GovernanceMonitor


class GovernanceIntelligenceOrchestrator:

    def run(self, input):

        return {
            "policy": PolicyEngine().define(input),
            "compliance": ComplianceIntelligence().check(input),
            "audit": AuditMemory().store(input),
            "regulation": RegulatoryMonitoring().monitor(input),
            "control": ControlFramework().control(input),
            "decision": GovernanceDecision().decide(input),
            "learning": GovernanceLearning().learn(input),
            "risk": RiskControl().evaluate(input),
            "monitor": GovernanceMonitor().observe(input),
            "status": "governance_intelligence_ready"
        }
