export class PythonRuntime {

execute(task:any){

    return {
        runtime:"python",
        task,
        status:"ready"
    };

}

}

