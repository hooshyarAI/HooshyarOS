class RuntimeInputRouter:

    def route(self, input):
        return {
            "input": input,
            "status": "runtime_input_routed"
        }
