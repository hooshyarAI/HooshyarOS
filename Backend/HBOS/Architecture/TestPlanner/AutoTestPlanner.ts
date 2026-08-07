export class AutoTestPlanner {

createPlan(module:any){

return {
    module,
    tests:[
        "unit",
        "integration"
    ]
};

}

}

