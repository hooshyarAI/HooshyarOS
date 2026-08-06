import { BuilderPipeline } from "../Builder/Pipeline/BuilderPipeline";


test("BuilderPipeline should connect analyzer and report",()=>{

    const pipeline = new BuilderPipeline();

    const result = pipeline.execute({

        projectName:"HooshyarOS",
        status:"READY",
        health:"GREEN",
        recommendations:[
            "next capability"
        ]

    });


    expect(result.ready).toBe(true);

    expect(result.report.projectName)
    .toBe("HooshyarOS");


});
