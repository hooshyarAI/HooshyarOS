export class BuilderSelfImprovementEngine {

private improvements:any[] = [];

evaluate(result:any){

    const improvement = {
        source: result,
        suggestion:"optimize next execution",
        timestamp:new Date()
    };

    this.improvements.push(improvement);

    return improvement;
}

getImprovements(){

    return this.improvements;

}

}
