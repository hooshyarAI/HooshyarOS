export class WorkflowEngine {


    execute(workflow:string){

        return {

            workflow,

            steps:[
                "PLAN",
                "BUILD",
                "TEST",
                "REVIEW"
            ]

        };

    }


}