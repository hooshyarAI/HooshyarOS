class TransactionRecoveryController:
    def recover(self, transaction):
        return {
            "transaction": transaction,
            "status": "transaction_recovery_ready"
        }
