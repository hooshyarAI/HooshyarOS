export class BuilderLearningLoop {

    private lessons:any[] = [];

    learn(event:any){
        this.lessons.push(event);
    }

    getLessons(){
        return this.lessons;
    }
}
