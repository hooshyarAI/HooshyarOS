export class TaskManager {

    private tasks:string[]=[];


    add(task:string){

        this.tasks.push(task);

    }


    getTasks(){

        return this.tasks;

    }

}