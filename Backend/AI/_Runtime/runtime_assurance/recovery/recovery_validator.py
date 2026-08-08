class RecoveryValidator:
    def validate(self, recovery):
        return {
            "recovery": recovery,
            "status": "recovery_validated",
        }
