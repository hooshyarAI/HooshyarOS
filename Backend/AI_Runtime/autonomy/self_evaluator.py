class SelfEvaluator:

    def evaluate(self, result):
        if result:
            return {
                "score": 1,
                "status": "accepted"
            }

        return {
            "score": 0,
            "status": "failed"
        }
