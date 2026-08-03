import { MemoryEngine } from "../Core/MemoryEngine";


test("MemoryEngine can store and retrieve memory", () => {

    const memory = new MemoryEngine();

    memory.store("HBOS Core Project Created");

    const result = memory.retrieve();

    expect(result).toContain("HBOS Core Project Created");

});