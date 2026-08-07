from Backend.AI_Runtime.memory.agent.memory_agent import MemoryAgent


def test_memory_agent():

    memory = MemoryAgent()

    result = memory.remember(
        "FinancialEngine"
    )

    assert result["status"] == "remembered"

    recall = memory.recall()

    assert "FinancialEngine" in recall["memory"]
