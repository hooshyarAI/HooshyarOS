class AutoGenRuntime:

    def __init__(self):
        self.agents=[]


    def register(self,agent):
        self.agents.append(agent)


    def status(self):

        return {
            "agents":len(self.agents),
            "runtime":"autogen"
        }
