export class TestGenerator {

generate(target:any){

return {
    testFor:target,
    type:[
        "unit",
        "integration"
    ]
};

}

}

