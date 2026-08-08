class ExecutionGuard:
    def guard(self, execution):
        return {
            "execution": execution,
            "status": "execution_guarded",
        }
