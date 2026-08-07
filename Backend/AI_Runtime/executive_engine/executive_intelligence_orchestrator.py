from Backend.AI_Runtime.executive_engine.executive_decision_engine import ExecutiveDecisionEngine
from Backend.AI_Runtime.decision_intelligence.decision_intelligence import DecisionIntelligence
from Backend.AI_Runtime.priority_engine.priority_engine import PriorityEngine
from Backend.AI_Runtime.action_planner.action_planner import ActionPlanner
from Backend.AI_Runtime.feedback_engine.feedback_engine import FeedbackEngine
from Backend.AI_Runtime.performance_intelligence.performance_intelligence import PerformanceIntelligence
from Backend.AI_Runtime.executive_dashboard.executive_dashboard import ExecutiveDashboard
from Backend.AI_Runtime.decision_memory.decision_memory import DecisionMemory
from Backend.AI_Runtime.goal_engine.goal_engine import GoalEngine


class ExecutiveIntelligenceOrchestrator:

    def run(self, input):

        return {
            "decision":
                ExecutiveDecisionEngine().decide(input),

            "analysis":
                DecisionIntelligence().analysis(input),

            "priority":
                PriorityEngine().rank(input),

            "action":
                ActionPlanner().plan(input),

            "feedback":
                FeedbackEngine().collect(input),

            "performance":
                PerformanceIntelligence().evaluate(input),

            "dashboard":
                ExecutiveDashboard().build(input),

            "memory":
                DecisionMemory().store(input),

            "goal":
                GoalEngine().manage(input),

            "status":
                "executive_intelligence_ready"
        }
