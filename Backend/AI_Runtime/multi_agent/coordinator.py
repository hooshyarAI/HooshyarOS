class MultiAgentCoordinator:

    def __init__(self):
        self.name = "MultiAgentCoordinator"


    def coordinate(self, agents):

        return {
            "agents": agents,
            "status": "coordinated"
        }
