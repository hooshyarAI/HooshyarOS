import { MemoryEngine } from "../Core/MemoryEngine";
import { MemoryEvent } from "../Core/MemoryEvent";


test("MemoryEngine can store and retrieve event", () => {

    const memory = new MemoryEngine();

    const event = new MemoryEvent(
        "PROJECT_CREATED",
        "HBOS Core",
        "Test"
    );

    memory.store(event);

    const result = memory.retrieve();

    expect(result[0].type).toBe("PROJECT_CREATED");

    expect(result[0].data).toBe("HBOS Core");

});