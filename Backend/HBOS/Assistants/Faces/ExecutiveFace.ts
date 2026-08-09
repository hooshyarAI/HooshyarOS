export class ExecutiveFace {

    name="ExecutiveFace";

    initialize(){
        console.log("ExecutiveFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
