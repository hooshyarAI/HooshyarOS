from Backend.AI_Runtime.context_engine.context_engine import ContextEngine


def test_chapter161_cross_engine_context():
    result = ContextEngine().build_cross_engine_context(
        {
            "reasoning": "ready",
            "governance": "ready",
            "executive": "ready",
            "organizational": "ready",
            "autonomous": "ready",
        }
    )

    assert result["status"] == "cross_engine_context_ready"
