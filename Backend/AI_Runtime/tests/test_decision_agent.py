from Backend.AI_Runtime.decision.agent.decision_agent import DecisionAgent


def test_decision_agent():

    agent = DecisionAgent()

    result = agent.decide(
        "FinancialEngine"
    )

    assert result["status"] == "decided"
    assert result["decision"] == "execute"
