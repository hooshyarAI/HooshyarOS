class ExecutionTrace:
    def trace(self, execution):
        return {
            "execution": execution,
            "status": "execution_traced",
        }
