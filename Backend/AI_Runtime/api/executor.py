from Backend.AI_Runtime.orchestrator.workflow import Orchestrator


orchestrator = Orchestrator()


def execute_goal(goal):

    return orchestrator.execute(goal)

