from Backend.AI_Runtime.agents.builder.builder_agent import BuilderAgent


def test_builder_generates_artifact():

    builder = BuilderAgent()

    result = builder.build(
        "FinancialEngine"
    )

    assert result["status"] == "generated"

    assert result["artifact"] == "FinancialEngine.py"