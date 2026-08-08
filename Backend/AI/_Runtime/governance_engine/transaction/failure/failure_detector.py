class TransactionFailureDetector:
    def detect(self, transaction):
        return {
            "transaction": transaction,
            "status": "transaction_failure_detected",
        }
