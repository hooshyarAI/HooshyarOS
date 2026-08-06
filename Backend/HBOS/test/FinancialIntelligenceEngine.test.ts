import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";


describe("FinancialIntelligenceEngine",()=>{


test("engine should initialize",()=>{


const engine=new FinancialIntelligenceEngine();


expect(
engine.initialize().status
)
.toBe("READY");


});


});
