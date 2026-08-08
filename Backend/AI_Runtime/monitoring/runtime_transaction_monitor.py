class RuntimeTransactionMonitor:
    def monitor(self, transaction):
        return {
            "transaction": transaction,
            "status": "runtime_transaction_monitored"
        }
