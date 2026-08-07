class AuditLogger:

    def log(self, event):

        return {
            "event": event,
            "status": "recorded"
        }
