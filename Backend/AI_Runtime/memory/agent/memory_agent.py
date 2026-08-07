from Backend.AI_Runtime.agents.base.runtime_agent import RuntimeAgent

class MemoryAgent(RuntimeAgent):

    def __init__(self):
        super().__init__(
            "MemoryAgent"
        )
        self.memory = []

    def remember(self, item):

        self.memory.append(item)

        return {
            "agent": self.name,
            "stored": item,
            "size": len(self.memory),
            "status": "remembered"
        }

    def recall(self):

        return {
            "agent": self.name,
            "memory": self.memory,
            "status": "recalled"
        }
