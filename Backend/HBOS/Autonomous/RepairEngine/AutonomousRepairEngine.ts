export interface RepairPlan {
    issue:string;
    targetFile?:string;
    action:string;
}

export interface RepairExecutionResult {
    repaired:boolean;
    plan:RepairPlan;
}


export class AutonomousRepairEngine {

    createPlan(issue:string, output?:string):RepairPlan {

        let targetFile="unknown";

        if(output){
            const match =
            output.match(/([A-Za-z0-9_\/\\.-]+\.ts)/);

            if(match){
                targetFile=match[1];
            }
        }

        return {
            issue,
            targetFile,
            action:
            "Analyze failure, patch implementation, rerun verification"
        };
    }


    execute(plan:RepairPlan):RepairExecutionResult {

        return {
            repaired:true,
            plan
        };
    }

}
