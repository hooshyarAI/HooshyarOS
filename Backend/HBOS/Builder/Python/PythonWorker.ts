export class PythonWorker {

run(task:string){

    return {
        task,
        status:"completed",
        worker:"python"
    };

}

}
