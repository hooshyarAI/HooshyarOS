class ComplianceEngine:

    def validate(self, rule):
        return {
            "rule": rule,
            "status": "validated"
        }

    def check(self, item):
        return {
            "item": item,
            "status": "checked"
        }
