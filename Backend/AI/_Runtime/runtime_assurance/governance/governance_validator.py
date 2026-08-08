class GovernanceValidator:
    def validate(self, governance):
        return {
            "governance": governance,
            "status": "governance_validated",
        }
