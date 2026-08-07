from Backend.AI_Runtime.autonomy.recovery_engine import RecoveryEngine


def test_recovery():

    result = RecoveryEngine().recover(
        "error"
    )

    assert result["status"] == "fixed"
