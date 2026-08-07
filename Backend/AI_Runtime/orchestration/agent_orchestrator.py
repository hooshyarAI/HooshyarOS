class AgentOrchestrator:

    def __init__(self):
        self.name = "AgentOrchestrator"

    def coordinate(self, agents):
        return {
            "agents": agents,
            "status": "coordinated"
        }
