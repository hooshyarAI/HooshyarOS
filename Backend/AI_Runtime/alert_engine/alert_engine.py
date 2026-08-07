class AlertEngine:

    def detect(self, signal):
        return {
            "signal": signal,
            "status": "alert_detected"
        }
