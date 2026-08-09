export class FinancialFace {

    name="FinancialFace";

    initialize(){
        console.log("FinancialFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
