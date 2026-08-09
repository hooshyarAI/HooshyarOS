export class KnowledgeFace {

    name="KnowledgeFace";

    initialize(){
        console.log("KnowledgeFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
