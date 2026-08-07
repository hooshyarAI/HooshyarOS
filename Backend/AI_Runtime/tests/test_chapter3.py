from Backend.AI_Runtime.memory.redis_adapter import RedisMemory
from Backend.AI_Runtime.memory.sqlite_fallback import SQLiteMemory
from Backend.AI_Runtime.events.publisher import EventPublisher
from Backend.AI_Runtime.scheduler.scheduler import AgentScheduler
from Backend.AI_Runtime.monitor.monitor import RuntimeMonitor



def test_redis_memory():

    m=RedisMemory()

    m.save(
        "goal",
        "engine"
    )

    assert m.get("goal")=="engine"



def test_sqlite():

    m=SQLiteMemory()

    m.save(
        "test",
        "ok"
    )

    assert True



def test_event():

    e=EventPublisher()

    e.publish("BUILD")

    assert e.consume()[0]=="BUILD"



def test_scheduler():

    s=AgentScheduler()

    s.add("task")

    assert s.next()=="task"



def test_monitor():

    m=RuntimeMonitor()

    assert m.health()["status"]=="healthy"

