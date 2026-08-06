import { BuilderDecisionAdapter } from "../Builder/Decision/BuilderDecisionAdapter";


test("BuilderDecisionAdapter should create decision",()=>{


    const adapter = new BuilderDecisionAdapter();


    const decision = adapter.createDecision({

        projectName:"HooshyarOS",

        status:"READY",

        health:"GREEN"

    });


    expect(decision.source)
    .toBe("Builder");


    expect(decision.action)
    .toBe("CONTINUE");


});
