from Backend.AI._Runtime.runtime_assurance.audit.audit_monitor import AuditMonitor

def test_chapter358_monitor():
    result = AuditMonitor().monitor("test-audit")
    assert result["audit"] == "test-audit"
    assert result["status"] == "audit_monitored"
