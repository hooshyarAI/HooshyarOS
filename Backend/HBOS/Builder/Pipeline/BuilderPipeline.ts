import { BuilderReportGenerator } from "../Report/BuilderReportGenerator";

export class BuilderPipeline {

    private reportGenerator: BuilderReportGenerator;

    constructor(){
        this.reportGenerator = new BuilderReportGenerator();
    }


    execute(analysis:any){

        const report = this.reportGenerator.generate(
            analysis
        );

        return {
            analysis,
            report,
            ready:true
        };

    }

}
