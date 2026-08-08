class TransactionSafetyGate:
    def validate(self, transaction):
        return {
            "transaction": transaction,
            "status": "transaction_safety_validated"
        }
