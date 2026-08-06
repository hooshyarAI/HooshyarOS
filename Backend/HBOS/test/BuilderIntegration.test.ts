import { EngineRegistry } from "../Registry/EngineRegistry";

test("BuilderEngine should register in HBOS Registry",()=>{

    const registry = new EngineRegistry();

    const engines = registry.initialize();

    const builder =
        engines.find(
            (e:any)=>e.constructor.name==="BuilderEngine"
        );

    expect(builder).toBeDefined();

});
