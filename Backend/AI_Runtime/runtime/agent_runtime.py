from Backend.AI_Runtime.runtime.agent_state import AgentState


class AgentRuntime:


    def __init__(self,agent):

        self.agent = agent

        self.state = AgentState.CREATED



    def run(self,task):

        self.state = AgentState.RUNNING

        result = self.agent.execute(task)

        self.state = AgentState.COMPLETED

        return result

