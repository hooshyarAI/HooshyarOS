export class AutonomousExecutionLoop {


execute(tasks:any[]){

return tasks.map(task=>({

...task,

executed:true

}));

}


}
