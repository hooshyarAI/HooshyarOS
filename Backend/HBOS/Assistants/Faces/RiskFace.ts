export class RiskFace {

    name="RiskFace";

    initialize(){
        console.log("RiskFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
