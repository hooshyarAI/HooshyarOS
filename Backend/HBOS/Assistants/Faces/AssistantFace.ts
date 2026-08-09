export class AssistantFace {

    name="AssistantFace";

    initialize(){
        console.log("AssistantFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
