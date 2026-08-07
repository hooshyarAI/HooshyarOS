from Backend.AI_Runtime.agents.supervisor.supervisor_agent import SupervisorAgent


class DemoAgent:

    def __init__(self,name):

        self.name=name


    def execute(self,task):

        return {
            "agent":self.name,
            "task":task,
            "result":"completed"
        }



def test_supervisor_cycle():

    supervisor=SupervisorAgent()


    planner=DemoAgent(
        "PlannerAgent"
    )


    result=supervisor.run_cycle(
        planner,
        "create financial plan"
    )


    assert result["result"]=="completed"


    report=supervisor.report()


    assert report["status"]=="active"
