from .contracts import RepairEvidence, RepairRequest, RepairResult


def test_repair_result_requires_verification_evidence() -> None:
    evidence = RepairEvidence("test", (), (), False)
    result = RepairResult("VERIFIED", evidence)
    assert result.accepted is False


def test_repair_request_is_explicit() -> None:
    request = RepairRequest("quality-gate", "missing evidence", {"source": "ci"})
    assert request.capability == "quality-gate"
    assert request.problem == "missing evidence"
