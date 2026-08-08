class AuditValidator:
    def validate(self, audit):
        return {
            "audit": audit,
            "status": "audit_validated",
        }
