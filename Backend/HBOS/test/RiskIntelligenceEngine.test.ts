import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";


describe("RiskIntelligenceEngine",()=>{

test("engine should initialize",()=>{

const engine=new RiskIntelligenceEngine();

expect(
engine.initialize().status
)
.toBe("READY");

});

});
