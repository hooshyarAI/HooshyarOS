export class OperationsFace {

    name="OperationsFace";

    initialize(){
        console.log("OperationsFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
