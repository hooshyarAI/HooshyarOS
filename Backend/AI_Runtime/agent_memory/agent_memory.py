class AgentMemory:

    def remember(self, data):
        return {
            "data": data,
            "status": "memory_saved"
        }

