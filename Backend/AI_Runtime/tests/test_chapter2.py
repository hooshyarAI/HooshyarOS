from Backend.AI_Runtime.runtime.agent_state import AgentState
from Backend.AI_Runtime.messaging.message import Message
from Backend.AI_Runtime.messaging.event_bus import EventBus
from Backend.AI_Runtime.memory.retriever import MemoryRetriever


def test_agent_state():

    assert AgentState.CREATED.value=="created"



def test_message():

    m=Message(
        "Planner",
        "Builder",
        "task"
    )

    assert m.target=="Builder"



def test_event_bus():

    bus=EventBus()

    bus.publish("BUILD")

    assert bus.consume()[0]=="BUILD"



def test_memory():

    m=MemoryRetriever()

    m.store(
        "goal",
        "financial"
    )

    assert m.retrieve("goal")=="financial"

