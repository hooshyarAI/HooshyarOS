from Backend.AI_Runtime.final_runtime.runtime_input_router import RuntimeInputRouter


def test_chapter171_runtime_input_router():

    result = RuntimeInputRouter().route({
        "source": "unified_runtime",
        "payload": "HooshyarOS"
    })

    assert result["status"] == "runtime_input_routed"
