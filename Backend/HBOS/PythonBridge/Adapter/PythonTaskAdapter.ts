export class PythonTaskAdapter {

adapt(task:any){

    return {
        payload:task,
        format:"python-task"
    };

}

}

