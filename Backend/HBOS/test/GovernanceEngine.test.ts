import { GovernanceEngine } from "../Engines/GovernanceEngine";


describe("GovernanceEngine",()=>{


test("engine should initialize",()=>{


const engine=new GovernanceEngine();


expect(
engine.initialize().status
)
.toBe("READY");


});


});
