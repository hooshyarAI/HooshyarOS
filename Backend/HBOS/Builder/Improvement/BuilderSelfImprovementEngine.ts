export class BuilderSelfImprovementEngine {

private lessons:any[]=[];

learn(result:any){

this.lessons.push(result);

}

getLessons(){

return this.lessons;

}

}

