export class BuilderLearningEngine {

private lessons:any[] = [];

learn(event:any){

    this.lessons.push({
        event,
        timestamp: new Date()
    });

}

getLessons(){

    return this.lessons;

}

}
