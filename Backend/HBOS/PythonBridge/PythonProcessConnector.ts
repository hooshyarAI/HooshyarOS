export class PythonProcessConnector {

execute(task:any){

    return {
        task,
        runtime:"python",
        status:"sent"
    };

}

}

