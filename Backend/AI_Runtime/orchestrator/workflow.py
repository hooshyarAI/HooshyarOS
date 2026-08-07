from Backend.AI_Runtime.agents.planner.planner_agent import PlannerAgent
from Backend.AI_Runtime.agents.builder.builder_agent import BuilderAgent
from Backend.AI_Runtime.agents.tester.tester_agent import TesterAgent


class Orchestrator:

    def __init__(self):

        self.planner = PlannerAgent()
        self.builder = BuilderAgent()
        self.tester = TesterAgent()


    def execute(self, goal):

        plan = self.planner.plan(goal)

        artifact = self.builder.build(goal)

        test = self.tester.test(
            artifact["artifact"]
        )

        return {
            "goal": goal,
            "plan": plan,
            "build": artifact,
            "test": test
        }
