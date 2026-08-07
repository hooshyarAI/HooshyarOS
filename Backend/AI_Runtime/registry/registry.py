class AgentRegistry:

    def __init__(self):

        self.agents = {}


    def register(self, agent):

        self.agents[agent.name] = {
            "agent": agent,
            "status": "registered"
        }


    def get_agent(self, name):

        return self.agents.get(name)


    def list_agents(self):

        return list(self.agents.keys())


    def status(self):

        return {
            name: data["status"]
            for name, data in self.agents.items()
        }

