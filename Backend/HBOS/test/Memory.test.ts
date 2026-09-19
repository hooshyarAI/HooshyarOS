import { MemoryEngine } from "../Engines/MemoryEngine";
import { MemoryEvent } from "../Entities/MemoryEvent";


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

test("canonical MemoryEngine owns the Memory capability and is a superset with listener support", () => {

    const memory = new MemoryEngine();

    expect(memory.name).toBe("MemoryEngine");
    expect(memory.health()).toBe(true);
    expect(() => memory.initialize()).not.toThrow();

    const received: MemoryEvent[] = [];
    const listener = { onEvent: (event: MemoryEvent) => received.push(event) };

    memory.addListener(listener);

    const event = new MemoryEvent("PROJECT_CREATED", "HooshyarOS", "test");
    memory.store(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("PROJECT_CREATED");

});

test("canonical MemoryEngine is the one registered in the HBOS runtime", async () => {
    const { HBOS } = await import("../Core/HBOS");

    const hbos = new HBOS();
    hbos.boot();

    const names = hbos.health().map((engine) => engine.name);

    expect(names).toContain("MemoryEngine");
    expect(names.filter((n) => n === "MemoryEngine")).toHaveLength(1);
});