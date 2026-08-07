from Backend.AI_Runtime.agents.tester.tester_agent import TesterAgent


def test_tester_agent():

    tester = TesterAgent()

    result = tester.test(
        "FinancialEngine.py"
    )

    assert result["status"] == "passed"

