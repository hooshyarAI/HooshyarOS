import { TestAIEngine } from "../Engines/TestAIEngine";


describe("TestAIEngine",()=>{


test("should initialize feature",()=>{


const engine =
new TestAIEngine();


expect(engine.execute().status)
.toBe("READY");


});


});
