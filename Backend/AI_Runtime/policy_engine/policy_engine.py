
class PolicyEngine:

    def define(self, input):
        return self.evaluate(input)

    def check(self, input):
        return self.evaluate(input)

    def evaluate(self, input):
        return {
            "input": input,
            "status": "policy_defined"
        }

