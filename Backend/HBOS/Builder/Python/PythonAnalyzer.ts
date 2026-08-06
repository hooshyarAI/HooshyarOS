export class PythonAnalyzer {

analyze(project:any){

    return {
        files: project.files || [],
        engines: project.engines || [],
        status:"analyzed"
    };

}

}
