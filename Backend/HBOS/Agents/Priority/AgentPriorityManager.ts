export class AgentPriorityManager {

rank(task:any){

    if(task.priority){
        return task.priority;
    }

    return "normal";

}

sort(tasks:any[]){

    return tasks.sort((a,b)=>{

        const order:any = {
            high:3,
            normal:2,
            low:1
        };

        return order[this.rank(b)] - order[this.rank(a)];

    });

}

}
