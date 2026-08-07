export class AutonomousBuilderController {

run(request:any){

return {
    request,
    steps:[
        "plan",
        "build",
        "test",
        "review",
        "deploy"
    ]
};

}

}

