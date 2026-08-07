export class BuilderOrchestrator {

execute(plan:any){

return {
    plan,
    pipeline:[
        "analyze",
        "build",
        "test",
        "approve"
    ]
};

}

}

