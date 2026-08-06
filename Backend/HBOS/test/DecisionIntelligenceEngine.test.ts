import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";


describe("DecisionIntelligenceEngine",()=>{

test("engine should initialize",()=>{

const engine=new DecisionIntelligenceEngine();

expect(
engine.initialize().status
)
.toBe("READY");

});

});
