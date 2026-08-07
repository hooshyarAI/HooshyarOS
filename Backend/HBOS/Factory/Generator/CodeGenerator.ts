export class CodeGenerator {

generate(spec:any){

return {

files:[
spec.name+".ts",
spec.name+".test.ts"
],

status:"generated"

};

}

}

