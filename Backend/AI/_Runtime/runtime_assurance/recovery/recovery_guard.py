class RecoveryGuard:
    def guard(self, recovery):
        return {
            "recovery": recovery,
            "status": "recovery_guarded",
        }
