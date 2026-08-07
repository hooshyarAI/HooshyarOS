class AuditMemory:

    def store(self, audit):
        return {
            "audit": audit,
            "status": "audit_saved"
        }
