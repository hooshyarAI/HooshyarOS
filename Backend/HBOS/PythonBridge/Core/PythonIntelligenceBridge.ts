export class PythonIntelligenceBridge {

constructor(
 private gateway:any
){}

execute(request:any){

    return this.gateway.send(request);

}

}

