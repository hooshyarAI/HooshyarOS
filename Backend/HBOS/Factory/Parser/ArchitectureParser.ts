export class ArchitectureParser {

parse(spec:any){

return {
    engine:spec.name,
    capabilities:spec.capabilities || [],
    dependencies:spec.dependencies || []
};

}

}

