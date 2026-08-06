import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";


describe("ExecutiveIntelligenceEngine",()=>{


test("engine should initialize",()=>{


const engine=new ExecutiveIntelligenceEngine();


expect(
engine.initialize().status
)
.toBe("READY");


});


});
