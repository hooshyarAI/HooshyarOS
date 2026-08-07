from Backend.AI_Runtime.decision.decision_engine import DecisionEngine


def test_decision_feedback():

    engine=DecisionEngine()


    result=engine.decide(
        "Build AI Financial Engine"
    )


    assert result["status"]=="created"


    engine.update(
        "planner completed successfully"
    )


    history=engine.history()


    assert history[0]["status"]=="updated"

    assert history[0]["feedback"]=="planner completed successfully"
