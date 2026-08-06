export class BuilderDecisionAdapter {


    createDecision(report:any){

        return {

            source:"Builder",

            project:report.projectName,

            status:report.status,

            health:report.health,

            action:
                report.health === "GREEN"
                ? "CONTINUE"
                : "REVIEW"

        };

    }


}
