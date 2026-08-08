class ExecutionValidator:
    def validate(self, execution):
        return {
            "execution": execution,
            "status": "execution_validated",
        }
