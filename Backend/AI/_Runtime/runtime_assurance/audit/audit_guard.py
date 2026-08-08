class AuditGuard:
    def guard(self, audit):
        return {
            "audit": audit,
            "status": "audit_guarded",
        }
