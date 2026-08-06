import { BuilderActionExecutor } from "../Builder/Action/BuilderActionExecutor";


test("BuilderActionExecutor should execute decision",()=>{


    const executor = new BuilderActionExecutor();


    const result = executor.execute({

        project:"HooshyarOS",

        action:"CONTINUE"

    });


    expect(result.executed)
    .toBe(true);


    expect(result.project)
    .toBe("HooshyarOS");


});
