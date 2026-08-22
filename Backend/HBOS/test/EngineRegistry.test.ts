import { EngineRegistry } from "../Core/EngineRegistry";

describe("Canonical EngineRegistry", () => {
    test("should register and report an engine", () => {
        const registry = new EngineRegistry();

        registry.register({
            name: "GovernanceEngine",
            initialize: () => undefined,
            health: () => true
        });

        expect(
            registry.getEngine("GovernanceEngine")?.name
        ).toBe("GovernanceEngine");

        expect(
            registry.healthReport().find(
                engine => engine.name === "GovernanceEngine"
            )?.healthy
        ).toBe(true);
    });
});
