import { EngineRegistry } from "../Registry/EngineRegistry";


describe("EngineRegistry",()=>{


test("should register engine",()=>{


const registry = new EngineRegistry();


registry.register(
    "GovernanceEngine",
    "READY"
);


expect(
 registry.find("GovernanceEngine")?.status
)
.toBe("READY");


});


});
