from Backend.AI_Runtime.enterprise_v2.enterprise_runtime import EnterpriseRuntimeV2


def test_enterprise_runtime():

    result = EnterpriseRuntimeV2().run(
        "HooshyarOS"
    )

    assert result["status"] == "enterprise_ready"
