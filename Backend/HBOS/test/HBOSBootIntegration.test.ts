import { HBOS } from "../Core/HBOS";

describe("HBOS Boot Integration", () => {
    test("boots through dependency validation and reports healthy registered engines", () => {
        const hbos = new HBOS();

        expect(hbos.boot()).toBe(true);

        const health = hbos.health();

        expect(health.length).toBeGreaterThanOrEqual(6);
        expect(health.every(engine => engine.healthy)).toBe(true);
        expect(health.map(engine => engine.name)).toEqual(expect.arrayContaining([
            "MemoryEngine",
            "ReactionEngine",
            "DecisionEngine",
            "ProjectPilotEngine",
            "KnowledgeEngine",
            "AssistantEngine"
        ]));
    });
});
