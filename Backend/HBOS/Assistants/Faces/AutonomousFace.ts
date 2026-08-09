export class AutonomousFace {

    name="AutonomousFace";

    initialize(){
        console.log("AutonomousFace Started");
    }

    respond(input:string){

        return {
            face:this.name,
            input,
            timestamp:new Date().toISOString()
        };

    }

}
