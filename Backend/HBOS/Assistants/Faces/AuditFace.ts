export class AuditFace {

    name="AuditFace";

    initialize(){
        console.log("AuditFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
