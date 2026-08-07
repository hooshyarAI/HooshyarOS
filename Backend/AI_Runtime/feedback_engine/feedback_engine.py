class FeedbackEngine:

    def collect(self, result):
        return {
            "result": result,
            "status": "feedback_collected"
        }
