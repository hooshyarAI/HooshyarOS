from Backend.AI._Runtime.organization.organizational_failure_controller import (
    OrganizationalFailureController,
)

def test_chapter340_organization():
    result = OrganizationalFailureController().detect("test-organization")

    assert result["organization"] == "test-organization"
    assert result["status"] == "organizational_failure_detected"
