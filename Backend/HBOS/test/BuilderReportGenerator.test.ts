import { BuilderReportGenerator } from "../Builder/Report/BuilderReportGenerator";

test("BuilderReportGenerator should generate report",()=>{

    const generator = new BuilderReportGenerator();

    const report = generator.generate({
        projectName:"HooshyarOS",
        status:"READY",
        health:"GREEN",
        recommendations:[
            "continue development"
        ]
    });

    expect(report.projectName).toBe("HooshyarOS");
    expect(report.health).toBe("GREEN");

});
