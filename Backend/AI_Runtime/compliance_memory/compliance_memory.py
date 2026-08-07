class ComplianceMemory:

    def save(self, record):
        return {
            "record": record,
            "status": "compliance_saved"
        }
