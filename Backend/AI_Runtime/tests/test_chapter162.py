from Backend.AI_Runtime.intelligence.signal_fusion import IntelligenceSignalFusion


def test_chapter162_signal_fusion():

    result = IntelligenceSignalFusion().fuse({
        "reasoning": "ready",
        "governance": "ready",
        "executive": "ready",
        "organizational": "ready",
        "autonomous": "ready",
    })

    assert result["status"] == "intelligence_signals_fused"
