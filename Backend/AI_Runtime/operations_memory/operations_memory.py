class OperationsMemory:

    def save(self, record):
        return {
            "record": record,
            "status": "operation_saved"
        }
