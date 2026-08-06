export class PythonExecutionMonitor {

private executions:any[]=[];

track(data:any){

    this.executions.push(data);

}

status(){

    return this.executions;

}

}

