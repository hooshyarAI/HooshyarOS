export class BuilderActionExecutor {


    execute(decision:any){


        return {

            executed:true,

            project:decision.project,

            action:decision.action,

            message:
                decision.action === "CONTINUE"
                ? "Builder continues lifecycle"
                : "Builder requires review"

        };


    }


}
