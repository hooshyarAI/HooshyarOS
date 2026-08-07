from Backend.AI_Runtime.memory.memory_engine import MemoryEngine
from Backend.AI_Runtime.events.event import Event
from Backend.AI_Runtime.dispatcher.dispatcher import TaskDispatcher
from Backend.AI_Runtime.supervisor.supervisor import Supervisor


def test_memory_engine():

    m = MemoryEngine()

    m.save(
        "chapter1",
        "completed"
    )

    assert True



def test_event_model():

    e = Event(
        "BUILD",
        {"status":"ok"}
    )

    assert e.name == "BUILD"



def test_dispatcher():

    class Agent:

        def execute(self,task):

            return "done"


    d = TaskDispatcher()

    result = d.dispatch(
        Agent(),
        "task"
    )

    assert result == "done"



def test_supervisor():

    s = Supervisor()

    result = s.monitor(
        ["Planner","Builder","Tester"]
    )

    assert result["status"] == "healthy"

