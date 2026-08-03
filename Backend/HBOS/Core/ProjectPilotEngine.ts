import { ProjectRegistry } from "./ProjectRegistry";
import { Project } from "./Project";


export class ProjectPilotEngine {

    name: string = "ProjectPilotEngine";

    private registry: ProjectRegistry;


    constructor() {

        this.registry = new ProjectRegistry();

    }


    initialize(): void {

        console.log("Project Pilot Engine Started");

    }


    health(): boolean {

        return true;

    }


    createProject(name: string): void {

        this.registry.addProject(name);

    }


    getProjects(): Project[] {

        return this.registry.listProjects();

    }

}