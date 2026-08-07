class SupervisorAgent:

    def __init__(self):

        self.history=[]


    def monitor(self,agents):

        status={}

        for agent in agents:

            status[agent.name]="ready"


        self.history.append(status)

        return status


    def run_cycle(self,agent,task):

        result=agent.execute(task)

        self.history.append(result)

        return result


    def report(self):

        return {
            "cycles":len(self.history),
            "status":"active"
        }
