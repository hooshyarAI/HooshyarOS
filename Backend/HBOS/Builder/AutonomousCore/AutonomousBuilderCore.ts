export class AutonomousBuilderCore {

run(context:any){

    return {
        status:"executed",
        context,
        autonomous:true
    };

}

}
