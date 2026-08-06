export class BuilderIntelligenceOrchestrator {

private history:any[] = [];

process(input:any){

    const result = {
        input,
        analyzed:true,
        advised:true,
        decision:"generated"
    };

    this.history.push(result);

    return result;
}

getHistory(){

    return this.history;

}

}
