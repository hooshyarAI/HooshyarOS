import { EngineRegistry } from "../Core/EngineRegistry";
import { BuilderEngine } from "../Builder/Core/BuilderEngine";

test("BuilderEngine should register in canonical HBOS Core Registry", () => {
    const registry = new EngineRegistry();

    registry.register(new BuilderEngine());

    registry.initializeAll();

    const builder = registry
        .healthReport()
        .find(engine => engine.name === "BuilderEngine");

    expect(builder).toBeDefined();
    expect(builder?.healthy).toBe(true);
});
