export class PythonCapabilityMapper {

map(task:any){

    return {
        capability: task.type,
        runtime:"python"
    };

}

}

