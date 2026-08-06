import { ProjectRegistry } from "../../Registry/ProjectRegistry";


export class BuilderProjectConnector {

    constructor(
        private registry: ProjectRegistry
    ){}


    createProject(name:string){

        const project = {
            name,
            status:"BUILDING"
        };


        this.registry.register(project);


        return project;
    }

}