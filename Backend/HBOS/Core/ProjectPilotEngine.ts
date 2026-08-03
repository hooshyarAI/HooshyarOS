import { ProjectRegistry } from "./ProjectRegistry";
import { Project } from "./Project";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectDecision } from "./ProjectDecision";


export class ProjectPilotEngine {

    name: string = "ProjectPilotEngine";

    private registry: ProjectRegistry;

    private decisionEngine: DecisionEngine;


    constructor() {

        this.registry = new ProjectRegistry();

        this.decisionEngine = new DecisionEngine();

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


    getProjectDecision(project: Project): ProjectDecision {

        return this.decisionEngine.evaluateProject(project.status);

    }

}