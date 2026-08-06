export class PythonProjectAnalyzer {

scan(project:any){

    return {
        project,
        engines: project.engines || [],
        modules: project.modules || [],
        status:"scanned"
    };

}

}
