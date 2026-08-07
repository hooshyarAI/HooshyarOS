export class FactorySelfLearning {

private patterns:any[]=[];

learn(result:any){

this.patterns.push(result);

}

patternsList(){

return this.patterns;

}

}

