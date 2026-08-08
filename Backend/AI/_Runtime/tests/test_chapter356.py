from Backend.AI._Runtime.runtime_assurance.audit.audit_guard import AuditGuard

def test_chapter356_guard():
    result = AuditGuard().guard("test-audit")
    assert result["audit"] == "test-audit"
    assert result["status"] == "audit_guarded"
