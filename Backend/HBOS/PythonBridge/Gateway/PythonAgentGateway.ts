export class PythonAgentGateway {

constructor(private connector:any){}

send(task:any){

    return this.connector.execute(task);

}

}

