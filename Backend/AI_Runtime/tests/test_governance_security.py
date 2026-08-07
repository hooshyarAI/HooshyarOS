from Backend.AI_Runtime.governance.governance_engine import GovernanceEngine
from Backend.AI_Runtime.governance.permission_manager import PermissionManager
from Backend.AI_Runtime.governance.audit_logger import AuditLogger
from Backend.AI_Runtime.governance.security_controller import SecurityController


def test_governance():

    result = GovernanceEngine().validate(
        "Execute Decision"
    )

    assert result["status"] == "approved"


def test_permission():

    result = PermissionManager().check(
        "manager",
        "read_financial_data"
    )

    assert result["allowed"] is True


def test_audit():

    result = AuditLogger().log(
        "system_event"
    )

    assert result["status"] == "recorded"


def test_security():

    result = SecurityController().protect(
        "company_data"
    )

    assert result["status"] == "secured"
