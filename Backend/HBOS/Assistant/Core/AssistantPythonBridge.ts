export class AssistantPythonBridge {


    execute(script:string){

        return {

            runtime:"python",

            script,

            status:"READY"

        };

    }

}
