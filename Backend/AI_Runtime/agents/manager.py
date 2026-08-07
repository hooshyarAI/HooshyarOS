class AgentManager:

    def __init__(self):
        self.agents=[]

    def register(self,agent):
        self.agents.append(agent)

    def list(self):
        return self.agents

