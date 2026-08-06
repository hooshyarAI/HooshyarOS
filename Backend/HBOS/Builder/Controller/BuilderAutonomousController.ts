export class BuilderAutonomousController {


    run(request:any){


        return {


            received:true,

            project:request.project,

            status:"READY"


        };


    }


}
