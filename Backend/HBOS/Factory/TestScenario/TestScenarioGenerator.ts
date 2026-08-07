export class TestScenarioGenerator {

generate(spec:any){

return {

target:spec.name,

tests:[
"unit",
"integration",
"health"
]

};

}

}

