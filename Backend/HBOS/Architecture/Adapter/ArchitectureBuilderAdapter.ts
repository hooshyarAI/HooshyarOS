export class ArchitectureBuilderAdapter {

constructor(private builder:any){}

buildFromDecision(decision:any){

return this.builder.build({
    source:"architecture-brain",
    decision
});

}

}

