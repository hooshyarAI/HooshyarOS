from Backend.AI_Runtime.autogen.runtime import AutoGenRuntime
from Backend.AI_Runtime.context.runtime_context import RuntimeContext
from Backend.AI_Runtime.feedback.feedback_engine import FeedbackEngine


def test_autogen_runtime():

    runtime=AutoGenRuntime()

    context=RuntimeContext()

    feedback=FeedbackEngine()


    context.set(
        "goal",
        "financial engine"
    )


    feedback.add(
        "planner completed"
    )


    assert context.get("goal")=="financial engine"

    assert feedback.list()[0]=="planner completed"


    assert runtime.status()["runtime"]=="autogen"
