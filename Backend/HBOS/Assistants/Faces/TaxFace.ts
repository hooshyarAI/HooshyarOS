export class TaxFace {

    name="TaxFace";

    initialize(){
        console.log("TaxFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
