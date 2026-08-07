export class ModuleGenerator {

generate(module:any){

return {
    files:[
        module.engine+".ts",
        module.engine+".test.ts"
    ],
    generated:true
};

}

}

