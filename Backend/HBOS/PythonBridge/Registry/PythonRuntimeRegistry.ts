export class PythonRuntimeRegistry {

private runtimes:any[]=[];

register(runtime:any){

    this.runtimes.push(runtime);

}

list(){

    return this.runtimes;

}

}

