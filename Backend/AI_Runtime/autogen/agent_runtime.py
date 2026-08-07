class AgentRuntime:

    def __init__(self):
        self.agents={}


    def register(self,agent):

        self.agents[agent.name]=agent


    def execute(self,name,task):

        agent=self.agents.get(name)

        if agent:
            return agent.execute(task)

        return None


    def list_agents(self):

        return list(self.agents.keys())
