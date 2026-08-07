class LearningEngine:

    def __init__(self):
        self.name = "LearningEngine"

    def learn(self, experience):
        return {
            "experience": experience,
            "status": "learned"
        }
