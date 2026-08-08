class AuditMonitor:
    def monitor(self, audit):
        return {
            "audit": audit,
            "status": "audit_monitored",
        }
