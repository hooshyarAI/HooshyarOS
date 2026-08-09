export class AccountingFace {

    name="AccountingFace";

    initialize(){
        console.log("AccountingFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
