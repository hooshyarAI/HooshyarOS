class GovernanceEngine:

    def __init__(self):
        self.name = "GovernanceEngine"

    def validate(self, action):

        return {
            "action": action,
            "status": "approved"
        }
