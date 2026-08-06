export class SelfLearningLoop {

private history:any[] = [];

learn(event:any){

    this.history.push(event);

    return {
        learned:true,
        total:this.history.length
    };

}

getHistory(){

    return this.history;

}

}
