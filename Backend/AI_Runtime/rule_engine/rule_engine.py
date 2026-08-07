class RuleEngine:

    def validate(self, rule):
        return {
            "rule": rule,
            "status": "rule_validated"
        }
